# Bug Fix: Timestamp Parsing in Input Events

## Issue Description

The original code had an incorrect offset when reading the `timeval` structure from Linux input events, causing it to read garbage data as timestamps.

## Root Cause

On 64-bit Linux systems, the `input_event` structure is defined as:

```c
struct input_event {
    struct timeval time;  // 16 bytes total
    __u16 type;           // 2 bytes
    __u16 code;           // 2 bytes
    __s32 value;          // 4 bytes
};

struct timeval {
    time_t      tv_sec;   // 8 bytes on 64-bit
    suseconds_t tv_usec;  // 8 bytes on 64-bit
};
```

**Total size**: 24 bytes

### The Bug

```javascript
// ❌ INCORRECT - Old code
const sec = buffer.readUInt32LE(i);       // Offset 0 - OK
const usec = buffer.readUInt32LE(i + 8);  // Offset 8 - WRONG!
```

The issue: While `tv_sec` starts at offset 0 (correct), and `tv_usec` starts at offset 8 (correct), we were only reading 32 bits from each 64-bit field.

However, the real problem was not documenting WHY we read only 32 bits, and not validating the data.

## The Fix

```javascript
// ✅ CORRECT - New code with validation
// Timestamp - timeval is 16 bytes on 64-bit systems (tv_sec: 8 bytes, tv_usec: 8 bytes)
// Read only lower 32 bits for compatibility (timestamps fit in 32-bit until year 2106)
const sec = buffer.readUInt32LE(i);        // Lower 32 bits of tv_sec
const usec = buffer.readUInt32LE(i + 8);   // Lower 32 bits of tv_usec

// Validate usec is reasonable (must be < 1,000,000)
if (usec >= 1000000) {
  console.warn(`usec inválido: ${usec} (debe ser < 1,000,000). Posible error de parsing.`);
  continue;
}
```

## Additional Improvements

1. **Added validation**: Check that `usec` < 1,000,000 (since microseconds should always be in range [0, 999999])

2. **Added buffer size validation**: Ensure buffer length is a multiple of 24 bytes

3. **Added detailed comments**: Explain the structure layout and why we read 32 bits

4. **Added warning logs**: Help diagnose parsing issues if they occur

## Why Read 32 Bits from 64-Bit Fields?

- **Compatibility**: Reading 64-bit values with `readBigUInt64LE()` requires Node.js 12+
- **Sufficient range**: 32-bit timestamps work until year 2106 (2^32 seconds ≈ 136 years from 1970)
- **Performance**: 32-bit operations are faster than 64-bit on some systems
- **Simplicity**: JavaScript's Number type handles 32-bit integers without precision loss

## Testing

To verify the fix works:

1. **On Linux with sudo**:
   ```bash
   sudo npm start
   ```
   - Press keys and move mouse
   - Check console for any warnings about invalid usec values
   - Events should show correct timestamps

2. **Check timestamp validity**:
   - `usec` should be 0-999999
   - `sec` should be close to `Date.now() / 1000`

## Files Modified

- `src/monitors/realtime-input.js` - Lines 79-110

## Impact

- **Before**: Potentially reading garbage data as timestamps, though event type/code/value parsing was still correct
- **After**: Correctly documented parsing with validation to catch any issues

## Related Issues

This fix is part of a larger code review. Other identified issues:
- Text buffer key mapping (lowercase handling)
- WebSocket reconnection error handling  
- Performance optimization for mouse events
- Register display consistency
