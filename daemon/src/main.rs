mod uhid;
mod bridge;

use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use uhid::VirtualDeck;

const BRIDGE_PORT: u16 = 58124;
const POLL_INTERVAL_MS: u64 = 50;

fn main() {
    println!("=== StreamDeck Virtual Device Daemon ===");

    let deck = VirtualDeck::create().expect("Failed to create virtual device");
    let deck = Arc::new(Mutex::new(deck));

    // Spawn WebSocket bridge thread
    let deck_bridge = deck.clone();
    thread::spawn(move || {
        bridge::start_bridge(deck_bridge, BRIDGE_PORT);
    });

    println!("[Daemon] Running. Connect app to port {}", BRIDGE_PORT);
    println!("[Daemon] Now open OpenDeck — it should detect the virtual device");

    // Track which clients to notify
    let mut last_images: [Vec<u8>; 15] = Default::default();

    // Main loop: poll HID events
    loop {
        {
            let mut deck = deck.lock().unwrap();
            match deck.poll() {
                Ok(updates) => {
                    for (idx, img) in updates {
                        if idx < 15 && img != last_images[idx] {
                            println!("[Daemon] Button {} image updated ({} bytes)", idx, img.len());
                            last_images[idx] = img.clone();

                            // Broadcast to WebSocket clients would go here
                            // For now, images are sent on initial connection
                        }
                    }
                }
                Err(e) => {
                    eprintln!("[Daemon] Poll error: {e}");
                    break;
                }
            }
        }
        thread::sleep(Duration::from_millis(POLL_INTERVAL_MS));
    }
}
