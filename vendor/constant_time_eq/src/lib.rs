#![no_std]

pub fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }

    let mut r: u8 = 0;
    for i in 0..a.len() {
        r |= a[i] ^ b[i];
    }
    r == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn eq_works() {
        assert!(constant_time_eq(b"abc", b"abc"));
        assert!(!constant_time_eq(b"abc", b"abd"));
        assert!(!constant_time_eq(b"abc", b"ab"));
    }
}
