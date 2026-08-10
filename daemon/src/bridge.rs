use std::net::TcpListener;
use std::thread;
use std::sync::{Arc, Mutex};
use tungstenite::accept;
use serde::{Serialize, Deserialize};
use crate::uhid::{VirtualDeck, COLS, ROWS};

#[derive(Serialize, Clone)]
struct ButtonImage {
    index: usize,
    col: usize,
    row: usize,
    #[serde(rename = "imageBase64")]
    image_base64: String,
}

#[derive(Serialize)]
struct DeckState {
    columns: usize,
    rows: usize,
    buttons: Vec<ButtonImage>,
}

#[derive(Deserialize, Debug)]
#[serde(tag = "type")]
enum MobileEvent {
    #[serde(rename = "buttonDown")]
    ButtonDown { index: usize },
    #[serde(rename = "buttonUp")]
    ButtonUp { index: usize },
}

pub fn start_bridge(deck: Arc<Mutex<VirtualDeck>>, port: u16) {
    let listener = TcpListener::bind(format!("0.0.0.0:{port}"))
        .expect(&format!("Cannot bind to port {port}"));

    println!("[Bridge] WebSocket server on port {port}");

    for stream in listener.incoming() {
        match stream {
            Ok(tcp) => {
                let deck = deck.clone();
                thread::spawn(move || {
                    let mut ws = match accept(tcp) {
                        Ok(ws) => ws,
                        Err(_) => return,
                    };

                    println!("[Bridge] Mobile client connected");

                    // Send initial state
                    let state = build_state(&deck.lock().unwrap());
                    let _ = ws.send(tungstenite::Message::Text(serde_json::to_string(&state).unwrap()));

                    // Handle messages from mobile
                    loop {
                        match ws.read() {
                            Ok(tungstenite::Message::Text(text)) => {
                                if let Ok(event) = serde_json::from_str::<MobileEvent>(&text) {
                                    let mut deck = deck.lock().unwrap();
                                    match event {
                                        MobileEvent::ButtonDown { index } => {
                                            let _ = deck.press_button(index);
                                        }
                                        MobileEvent::ButtonUp { index } => {
                                            let _ = deck.release_button(index);
                                        }
                                    }
                                }
                            }
                            Ok(tungstenite::Message::Close(_)) => break,
                            Err(_) => break,
                            _ => {}
                        }
                    }

                    println!("[Bridge] Mobile client disconnected");
                });
            }
            Err(e) => eprintln!("[Bridge] Connection error: {e}"),
        }
    }
}

fn build_state(deck: &VirtualDeck) -> DeckState {
    let buttons: Vec<ButtonImage> = (0..(COLS * ROWS))
        .map(|i| {
            let img = &deck.images[i];
            ButtonImage {
                index: i,
                col: i % COLS,
                row: i / COLS,
                image_base64: if img.is_empty() {
                    String::new()
                } else {
                    use base64::{Engine as _, engine::general_purpose::STANDARD};
                    STANDARD.encode(img)
                },
            }
        })
        .collect();

    DeckState {
        columns: COLS,
        rows: ROWS,
        buttons,
    }
}

