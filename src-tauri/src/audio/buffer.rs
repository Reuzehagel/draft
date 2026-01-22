//! Lock-free audio buffer for real-time safe communication between
//! the audio callback thread and the processing worker thread.
//!
//! Key constraints:
//! - Producer (audio callback) must NEVER allocate or lock
//! - Non-blocking push - drops samples on overflow rather than blocking
//! - Uses crossbeam bounded channel for lock-free communication

use crossbeam::channel::{self, Receiver, Sender, TrySendError};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

/// Capacity for 5 seconds of 48kHz stereo audio
/// 48000 samples/sec * 2 channels * 5 seconds = 480,000 samples
const BUFFER_CAPACITY: usize = 480_000;

/// Producer side of the audio buffer - used by audio callback
/// MUST be real-time safe: no allocations, no locks, no I/O
#[derive(Clone)]
pub struct AudioProducer {
    sender: Sender<f32>,
    stop_flag: Arc<AtomicBool>,
}

impl AudioProducer {
    /// Push samples to the buffer (non-blocking)
    /// Drops samples if buffer is full - this is acceptable for real-time audio
    /// as we prioritize not blocking the audio callback
    #[inline]
    pub fn push(&self, samples: &[f32]) {
        if self.stop_flag.load(Ordering::Relaxed) {
            return;
        }

        for &sample in samples {
            // Non-blocking send - silently drop if full
            if let Err(TrySendError::Disconnected(_)) = self.sender.try_send(sample) {
                // Channel disconnected, stop pushing
                break;
            }
            // TrySendError::Full is silently ignored - we drop samples on overflow
        }
    }
}

/// Consumer side of the audio buffer - used by worker thread
pub struct AudioConsumer {
    receiver: Receiver<f32>,
    stop_flag: Arc<AtomicBool>,
}

impl AudioConsumer {
    /// Drain all available samples into the provided vector
    /// Non-blocking - returns immediately with whatever samples are available
    pub fn drain_into(&self, output: &mut Vec<f32>) {
        // Use try_iter to get all available samples without blocking
        output.extend(self.receiver.try_iter());
    }

    /// Check if the buffer has been signaled to stop
    pub fn should_stop(&self) -> bool {
        self.stop_flag.load(Ordering::Relaxed)
    }
}

/// Create a new audio buffer pair (producer, consumer)
pub fn create_buffer() -> (AudioProducer, AudioConsumer) {
    let (sender, receiver) = channel::bounded(BUFFER_CAPACITY);
    let stop_flag = Arc::new(AtomicBool::new(false));

    let producer = AudioProducer {
        sender,
        stop_flag: stop_flag.clone(),
    };

    let consumer = AudioConsumer {
        receiver,
        stop_flag,
    };

    (producer, consumer)
}

/// Explicitly stop the buffer - signals both producer and consumer to stop
pub fn stop_buffer(producer: &AudioProducer) {
    producer.stop_flag.store(true, Ordering::SeqCst);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_buffer_basic() {
        let (producer, consumer) = create_buffer();

        // Push some samples
        producer.push(&[1.0, 2.0, 3.0]);

        // Drain them
        let mut output = Vec::new();
        consumer.drain_into(&mut output);

        assert_eq!(output, vec![1.0, 2.0, 3.0]);
    }

    #[test]
    fn test_buffer_stop_flag() {
        let (producer, consumer) = create_buffer();

        assert!(!consumer.should_stop());

        stop_buffer(&producer);

        assert!(consumer.should_stop());
    }
}
