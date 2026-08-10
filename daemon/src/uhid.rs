use std::os::unix::io::AsRawFd;
use std::fs::{File, OpenOptions};
use std::io::Read;
use std::mem::{ManuallyDrop, size_of};
use std::slice;

fn iow(ty: u8, nr: u8, size: u32) -> u32 {
    ((ty as u32) << 8) | (nr as u32) | (size << 16)
}

const UHID_TYPE: u8 = b'H';
const UHID_CREATE: u8 = 0x01;
const UHID_DESTROY: u8 = 0x03;
const UHID_INPUT_EV: u8 = 0x0a;
const UHID_OUTPUT_EV: u32 = 0x0b;
const UHID_START_EV: u32 = 0x05;
const UHID_STOP_EV: u32 = 0x06;

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

#[repr(C, packed)]
struct UhidCreateReq {
    name: [u8; 128],
    phys: [u8; 64],
    uniq: [u8; 64],
    rd_data: u64,
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

pub struct VirtualDeck {
    file: File,
    pub buttons: [bool; BUTTON_COUNT],
    pub images: [Vec<u8>; BUTTON_COUNT],
}

impl VirtualDeck {
    pub fn create() -> Result<Self, String> {
        let file = OpenOptions::new()
            .read(true).write(true)
            .open("/dev/uhid")
            .map_err(|e| format!("Cannot open /dev/uhid: {e}. Try: sudo modprobe uhid && sudo chmod 666 /dev/uhid"))?;

        let fd = file.as_raw_fd();

        let mut name = [0u8; 128];
        name[..33].copy_from_slice(b"StreamDeck Mobile (Virtual MK.2)\0");

        let mut phys = [0u8; 64];
        phys[..19].copy_from_slice(b"virtual-streamdeck\0");

        let mut uniq = [0u8; 64];
        uniq[..13].copy_from_slice(b"SD-MOBILE-01\0");

        let create_req = UhidCreateReq {
            name, phys, uniq,
            rd_data: REPORT_DESCRIPTOR.as_ptr() as u64,
            rd_size: REPORT_DESCRIPTOR.len() as u16,
            bus: 0x06,
            vendor: STREAMDECK_VID,
            product: STREAMDECK_PID,
            version: 0,
            country: 0,
        };

        let code = iow(UHID_TYPE, UHID_CREATE, size_of::<UhidCreateReq>() as u32);
        let ret = unsafe { libc::ioctl(fd, code as _, &create_req) };
        if ret != 0 {
            return Err(format!("UHID_CREATE ioctl failed (errno: {})", ret));
        }

        println!("[VirtualDeck] Device created (VID:{:04x} PID:{:04x})", STREAMDECK_VID, STREAMDECK_PID);

        const EMPTY: Vec<u8> = Vec::new();
        Ok(VirtualDeck { file, buttons: [false; BUTTON_COUNT], images: [EMPTY; BUTTON_COUNT] })
    }

    pub fn poll(&mut self) -> Result<Vec<(usize, Vec<u8>)>, String> {
        let mut event: UhidEvent = unsafe { std::mem::zeroed() };
        let size = size_of::<UhidEvent>();

        match self.file.read(unsafe { slice::from_raw_parts_mut(&mut event as *mut UhidEvent as *mut u8, size) }) {
            Ok(n) if n == size => {}
            Ok(_) => return Ok(Vec::new()),
            Err(e) => return Err(format!("read error: {e}")),
        }

        let mut updated = Vec::new();

        match event.type_ {
            UHID_START_EV => println!("[VirtualDeck] UHID_START — OpenDeck connected"),
            UHID_STOP_EV => {
                println!("[VirtualDeck] UHID_STOP — OpenDeck disconnected");
                for img in &mut self.images { *img = Vec::new(); }
            }
            UHID_OUTPUT_EV => unsafe {
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
        let fd = self.file.as_raw_fd();
        let mut data = [0u8; 32];
        data[0] = 0x01;
        for (i, &pressed) in self.buttons.iter().enumerate() {
            if pressed { data[1 + i / 8] |= 1 << (i % 8); }
        }
        let req = UhidInputReq { data, size: 5 };
        let code = iow(UHID_TYPE, UHID_INPUT_EV, size_of::<UhidInputReq>() as u32);
        let ret = unsafe { libc::ioctl(fd, code as _, &req) };
        if ret != 0 { return Err(format!("UHID_INPUT failed: {ret}")); }
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
        let code = iow(UHID_TYPE, UHID_DESTROY, size_of::<u32>() as u32);
        unsafe { libc::ioctl(self.file.as_raw_fd(), code as _, &0u32); }
        println!("[VirtualDeck] Device destroyed");
    }
}
