use std::os::unix::io::AsRawFd;
use std::fs::{File, OpenOptions};
use std::io::Read;
use std::mem::ManuallyDrop;
use std::slice;
use nix::ioctl_write_ptr;

// ─── C structures for uhid ────────────────────────────────────────────────────

const UHID_CREATE: u8 = 0x01;
const UHID_DESTROY: u8 = 0x03;
const UHID_INPUT: u8 = 0x0a;
const UHID_OUTPUT: u32 = 0x0b;
const UHID_START: u32 = 0x05;
const UHID_STOP: u32 = 0x06;

const STREAMDECK_VID: u32 = 0x0fd9;
const STREAMDECK_PID: u32 = 0x0080; // MK.2

pub const COLS: usize = 5;
pub const ROWS: usize = 3;
pub const BUTTON_COUNT: usize = COLS * ROWS;

/// HID report descriptor for Stream Deck MK.2 (5x3, 15 buttons + image output)
const REPORT_DESCRIPTOR: &[u8] = &[
    0x06, 0x00, 0xff,           // Usage Page (Vendor Defined FF00h)
    0x09, 0x01,                 // Usage (01h)
    0xa1, 0x01,                 // Collection (Application)
    0x85, 0x01,                 //   Report ID (1) — button input
    0x09, 0x01,                 //   Usage (01h)
    0x15, 0x00,                 //   Logical Minimum (0)
    0x25, 0x01,                 //   Logical Maximum (1)
    0x75, 0x01,                 //   Report Size (1)
    0x95, 0x20,                 //   Report Count (32)
    0x81, 0x02,                 //   Input (Data,Var,Abs)
    0x85, 0x02,                 //   Report ID (2) — image output
    0x09, 0x02,                 //   Usage (02h)
    0x75, 0x08,                 //   Report Size (8)
    0x96, 0x00, 0x04,           //   Report Count (1024)
    0x91, 0x02,                 //   Output (Data,Var,Abs)
    0x85, 0x03,                 //   Report ID (3) — feature
    0x09, 0x03,                 //   Usage (03h)
    0x75, 0x08,                 //   Report Size (8)
    0x95, 0x20,                 //   Report Count (32)
    0xb1, 0x02,                 //   Feature (Data,Var,Abs)
    0xc0,                       // End Collection
];

#[repr(C, packed)]
struct UhidCreateReq {
    name: [u8; 128],
    phys: [u8; 64],
    uniq: [u8; 64],
    rd_data: u64,   // pointer to report descriptor
    rd_size: u16,
    bus: u16,
    vendor: u32,
    product: u32,
    version: u32,
    country: u32,
}

#[repr(C, packed)]
struct UhidInputReq {
    data: [u8; 32],
    size: u16,
}

#[repr(C, packed)]
struct UhidOutputReq {
    data: [u8; 1024],
    size: u16,
    rtype: u8,
}

#[repr(C)]
union UhidEventData {
    create: ManuallyDrop<UhidCreateReq>,
    input: ManuallyDrop<UhidInputReq>,
    output: ManuallyDrop<UhidOutputReq>,
}

#[repr(C)]
struct UhidEvent {
    type_: u32,
    u: UhidEventData,
}

ioctl_write_ptr!(uhid_create, b'H', UHID_CREATE, UhidCreateReq);
ioctl_write_ptr!(uhid_destroy, b'H', UHID_DESTROY, u32);
ioctl_write_ptr!(uhid_input, b'H', UHID_INPUT, UhidInputReq);

// ─── Virtual Deck ─────────────────────────────────────────────────────────────

pub struct VirtualDeck {
    file: File,
    pub buttons: [bool; BUTTON_COUNT],
    /// Latest JPEG per button (index = col + row * COLS)
    pub images: [Vec<u8>; BUTTON_COUNT],
}

impl VirtualDeck {
    pub fn create() -> Result<Self, String> {
        let file = OpenOptions::new()
            .read(true)
            .write(true)
            .open("/dev/uhid")
            .map_err(|e| format!("Cannot open /dev/uhid: {e}. Try: sudo modprobe uhid"))?;

        let fd = file.as_raw_fd();

        // Create device name
        let mut name = [0u8; 128];
        let name_str = b"StreamDeck Mobile (Virtual MK.2)";
        name[..name_str.len()].copy_from_slice(name_str);

        let mut phys = [0u8; 64];
        let phys_str = b"virtual-streamdeck";
        phys[..phys_str.len()].copy_from_slice(phys_str);

        let mut uniq = [0u8; 64];
        let uniq_str = b"SD-MOBILE-001";
        uniq[..uniq_str.len()].copy_from_slice(uniq_str);

        let mut create_req = UhidCreateReq {
            name,
            phys,
            uniq,
            rd_data: REPORT_DESCRIPTOR.as_ptr() as u64,
            rd_size: REPORT_DESCRIPTOR.len() as u16,
            bus: 0x06,       // BUS_VIRTUAL
            vendor: STREAMDECK_VID,
            product: STREAMDECK_PID,
            version: 0,
            country: 0,
        };

        unsafe {
            uhid_create(fd, &mut create_req)
                .map_err(|e| format!("UHID_CREATE ioctl failed: {e}"))?;
        }

        println!("[VirtualDeck] Device created (VID:{:04x} PID:{:04x})", STREAMDECK_VID, STREAMDECK_PID);

        const EMPTY: Vec<u8> = Vec::new();
        Ok(VirtualDeck {
            file,
            buttons: [false; BUTTON_COUNT],
            images: [EMPTY; BUTTON_COUNT],
        })
    }

    /// Process HID events from OpenDeck. Returns Some(button_images) when images update.
    pub fn poll(&mut self) -> Result<Vec<(usize, Vec<u8>)>, String> {
        let mut event: UhidEvent = unsafe { std::mem::zeroed() };
        let size = std::mem::size_of::<UhidEvent>();

        match self.file.read(unsafe {
            slice::from_raw_parts_mut(
                &mut event as *mut UhidEvent as *mut u8,
                size,
            )
        }) {
            Ok(n) if n == size => {}
            Ok(_) => return Ok(Vec::new()),
            Err(e) => return Err(format!("read error: {e}")),
        }

        let mut updated = Vec::new();

        match event.type_ {
            UHID_START => {
                println!("[VirtualDeck] OpenDeck connected (UHID_START)");
            }
            UHID_STOP => {
                println!("[VirtualDeck] OpenDeck disconnected (UHID_STOP)");
                // Clear all images
                for img in &mut self.images {
                    *img = Vec::new();
                }
            }
            UHID_OUTPUT => {
                unsafe {
                    let out = &event.u.output;
                    let data = &out.data[..out.size as usize];
                    let rtype = out.rtype;

                    // Parse image report (report ID 2, JPEG per-button)
                    if rtype == 2 && data.len() >= 4 {
                        let button_idx = data[1] as usize;
                        let is_last = data[2] == 1;
                        let payload = &data[4..];

                        if button_idx < BUTTON_COUNT {
                            if !is_last {
                                self.images[button_idx].extend_from_slice(payload);
                            } else {
                                self.images[button_idx].extend_from_slice(payload);
                                let img = self.images[button_idx].clone();
                                self.images[button_idx].clear();
                                updated.push((button_idx, img));
                            }
                        }
                    }
                }
            }
            _ => {}
        }

        Ok(updated)
    }

    /// Send button press/release state to OpenDeck
    pub fn send_buttons(&mut self) -> Result<(), String> {
        let fd = self.file.as_raw_fd();

        // Build button state bitmap (32 bits)
        let mut bitmap = [0u8; 4];
        for (i, pressed) in self.buttons.iter().enumerate() {
            if *pressed {
                bitmap[i / 8] |= 1 << (i % 8);
            }
        }

        let mut data = [0u8; 32];
        data[0] = 0x01; // report ID 1
        data[1..5].copy_from_slice(&bitmap);

        let input_req = UhidInputReq {
            data,
            size: 5,
        };

        unsafe {
            uhid_input(fd, &input_req)
                .map_err(|e| format!("UHID_INPUT ioctl failed: {e}"))?;
        }

        Ok(())
    }

    pub fn press_button(&mut self, index: usize) -> Result<(), String> {
        if index < BUTTON_COUNT {
            self.buttons[index] = true;
            self.send_buttons()?;
        }
        Ok(())
    }

    pub fn release_button(&mut self, index: usize) -> Result<(), String> {
        if index < BUTTON_COUNT {
            self.buttons[index] = false;
            self.send_buttons()?;
        }
        Ok(())
    }
}

impl Drop for VirtualDeck {
    fn drop(&mut self) {
        let fd = self.file.as_raw_fd();
        unsafe {
            let _ = uhid_destroy(fd, &0u32);
        }
        println!("[VirtualDeck] Device destroyed");
    }
}
