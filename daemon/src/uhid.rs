use std::fs::{File, OpenOptions};
use std::io::{Read, Write};
use std::mem::{ManuallyDrop, size_of};
use std::slice;

const UHID_CREATE2: u32 = 12;
const UHID_DESTROY: u32 = 1;
const UHID_START: u32 = 2;
const UHID_STOP: u32 = 3;
const UHID_OUTPUT: u32 = 6;
const UHID_INPUT2: u32 = 13;

const STREAMDECK_VID: u32 = 0x0fd9;
const STREAMDECK_PID: u32 = 0x0080;

pub const COLS: usize = 5;
pub const ROWS: usize = 3;
pub const BUTTON_COUNT: usize = COLS * ROWS;

const REPORT_DESCRIPTOR: &[u8] = &[
    0x06, 0x00, 0xff, 0x09, 0x01, 0xa1, 0x01,
    0x85, 0x01, 0x09, 0x01, 0x15, 0x00, 0x25, 0x01,
    0x75, 0x01, 0x95, 0x20, 0x81, 0x02,
    0x85, 0x02, 0x09, 0x02, 0x75, 0x08, 0x96, 0x00, 0x04, 0x91, 0x02,
    0x85, 0x03, 0x09, 0x03, 0x75, 0x08, 0x95, 0x20, 0xb1, 0x02,
    0xc0,
];

const HID_MAX_DESCRIPTOR_SIZE: usize = 4096;
const UHID_DATA_MAX: usize = 4096;

#[repr(C, packed)]
struct UhidCreate2Req {
    name: [u8; 128],
    phys: [u8; 64],
    uniq: [u8; 64],
    rd_size: u16,
    bus: u16,
    vendor: u32,
    product: u32,
    version: u32,
    country: u32,
    rd_data: [u8; HID_MAX_DESCRIPTOR_SIZE],
}

#[repr(C, packed)]
struct UhidInput2Req {
    size: u16,
    data: [u8; UHID_DATA_MAX],
}

#[repr(C, packed)]
struct UhidOutputReq {
    data: [u8; UHID_DATA_MAX],
    size: u16,
    rtype: u8,
    _pad: [u8; 5],
}

#[repr(C, packed)]
struct UhidStartReq {
    dev_flags: u64,
}

#[repr(C)]
union UhidEventPayload {
    create2: ManuallyDrop<UhidCreate2Req>,
    input2: ManuallyDrop<UhidInput2Req>,
    output: ManuallyDrop<UhidOutputReq>,
    start: ManuallyDrop<UhidStartReq>,
}

#[repr(C)]
struct UhidEvent {
    type_: u32,
    u: UhidEventPayload,
}

pub struct VirtualDeck {
    file: File,
    pub buttons: [bool; BUTTON_COUNT],
    pub images: [Vec<u8>; BUTTON_COUNT],
}

impl VirtualDeck {
    pub fn create() -> Result<Self, String> {
        let mut file = OpenOptions::new()
            .read(true).write(true)
            .open("/dev/uhid")
            .map_err(|e| format!("Cannot open /dev/uhid: {e}"))?;

        // Build UHID_CREATE2 event
        let mut req = UhidCreate2Req {
            name: [0u8; 128],
            phys: [0u8; 64],
            uniq: [0u8; 64],
            rd_size: REPORT_DESCRIPTOR.len() as u16,
            bus: 5, // BUS_VIRTUAL
            vendor: STREAMDECK_VID,
            product: STREAMDECK_PID,
            version: 0,
            country: 0,
            rd_data: [0u8; HID_MAX_DESCRIPTOR_SIZE],
        };
        req.name[..33].copy_from_slice(b"StreamDeck Mobile (Virtual MK.2)\0");
        req.phys[..19].copy_from_slice(b"virtual-streamdeck\0");
        req.uniq[..13].copy_from_slice(b"SD-MOBILE-01\0");
        req.rd_data[..REPORT_DESCRIPTOR.len()].copy_from_slice(REPORT_DESCRIPTOR);

        let event = UhidEvent {
            type_: UHID_CREATE2,
            u: UhidEventPayload { create2: ManuallyDrop::new(req) },
        };

        let bytes = unsafe {
            slice::from_raw_parts(&event as *const UhidEvent as *const u8, size_of::<UhidEvent>())
        };
        file.write_all(bytes).map_err(|e| format!("UHID_CREATE2 write failed: {e}"))?;

        println!("[VirtualDeck] Device created (VID:{:04x} PID:{:04x})", STREAMDECK_VID, STREAMDECK_PID);

        const EMPTY: Vec<u8> = Vec::new();
        Ok(VirtualDeck { file, buttons: [false; BUTTON_COUNT], images: [EMPTY; BUTTON_COUNT] })
    }

    pub fn poll(&mut self) -> Result<Vec<(usize, Vec<u8>)>, String> {
        let mut event: UhidEvent = unsafe { std::mem::zeroed() };
        let size = size_of::<UhidEvent>();

        match self.file.read(unsafe {
            slice::from_raw_parts_mut(&mut event as *mut UhidEvent as *mut u8, size)
        }) {
            Ok(n) if n == size => {}
            Ok(_) => return Ok(Vec::new()),
            Err(e) => return Err(format!("read error: {e}")),
        }

        let mut updated = Vec::new();

        match event.type_ {
            UHID_START => println!("[VirtualDeck] START — OpenDeck connected"),
            UHID_STOP => {
                println!("[VirtualDeck] STOP — OpenDeck disconnected");
                for img in &mut self.images { *img = Vec::new(); }
            }
            UHID_OUTPUT => unsafe {
                let out = &event.u.output;
                let data = &out.data[..out.size as usize];
                if out.rtype == 2 && data.len() >= 4 {
                    let idx = data[1] as usize;
                    let last = data[2] == 1;
                    let payload = &data[4..];
                    if idx < BUTTON_COUNT {
                        if !last {
                            self.images[idx].extend_from_slice(payload);
                        } else {
                            self.images[idx].extend_from_slice(payload);
                            updated.push((idx, std::mem::take(&mut self.images[idx])));
                        }
                    }
                }
            },
            _ => {}
        }

        Ok(updated)
    }

    fn send_input(&mut self) -> Result<(), String> {
        let mut req = UhidInput2Req { size: 5, data: [0u8; UHID_DATA_MAX] };
        req.data[0] = 0x01;
        for (i, &pressed) in self.buttons.iter().enumerate() {
            if pressed { req.data[1 + i / 8] |= 1 << (i % 8); }
        }

        let event = UhidEvent {
            type_: UHID_INPUT2,
            u: UhidEventPayload { input2: ManuallyDrop::new(req) },
        };

        let bytes = unsafe {
            slice::from_raw_parts(&event as *const UhidEvent as *const u8, size_of::<UhidEvent>())
        };
        self.file.write_all(bytes).map_err(|e| format!("UHID_INPUT2 write failed: {e}"))?;
        Ok(())
    }

    pub fn press_button(&mut self, index: usize) -> Result<(), String> {
        if index < BUTTON_COUNT { self.buttons[index] = true; self.send_input()?; }
        Ok(())
    }

    pub fn release_button(&mut self, index: usize) -> Result<(), String> {
        if index < BUTTON_COUNT { self.buttons[index] = false; self.send_input()?; }
        Ok(())
    }
}

impl Drop for VirtualDeck {
    fn drop(&mut self) {
        let event = UhidEvent {
            type_: UHID_DESTROY,
            u: unsafe { std::mem::zeroed() },
        };
        let bytes = unsafe {
            slice::from_raw_parts(&event as *const UhidEvent as *const u8, size_of::<UhidEvent>())
        };
        let _ = self.file.write_all(bytes);
        println!("[VirtualDeck] Device destroyed");
    }
}
