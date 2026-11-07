# Browser Sync

Browser Sync is optional and uses the existing storage permission. It adds no account service or analytics.

## Security and recovery

- Accounts are encrypted with AES-256-GCM and a random 256-bit recovery key before upload. Account names, secrets, and counters stay encrypted; the browser provider can see data sizes and update timing.
- The recovery key stays inside your password-protected local vault. Save it somewhere safe. A connected, unlocked device can show it again; there is no recovery service.
- Devices can use different vault passwords. Changing one does not change the recovery key or revoke other devices. Backups exclude sync credentials.

## Behavior and limits

- Sync works within the same browser provider and extension identity on supported devices. It does not bridge providers; platform support varies. Firefox for Android keeps extension storage on the device, so Browser Sync is unavailable there.
- Changes merge while the extension is open and unlocked. The browser handles delivery. A successful check cannot confirm another device received the changes.
- Each device writes separate encrypted records. Concurrent edits resolve deterministically; deletions win against offline edits. Restores and credential replacements get fresh identities. Encrypted origin fingerprints recognize delayed copies without confusing different credentials. Preferences and ordering stay local.
- When older deletion records lack origin fingerprints, joining keeps local copies rather than guessing which credentials were deleted.
- HOTP counters never move backward during merging, but simultaneous use can repeat or skip codes. Use HOTP on one device at a time.
- Pending changes save locally before upload and retry after reopening. Invalid remote data pauses sync without replacing local accounts.
- Browser storage allows about 100 KB total and 8 KB per item, with item and write limits. Many devices or retained deletion records can fill it. Local accounts remain usable if sync fails.

## Disconnecting

**Stop syncing** or deleting the local vault keeps the encrypted synced copy. **Delete synced copy** removes the current group's cloud data and pauses other devices; their local accounts remain. The deleting browser remembers the group and removes late arrivals when it runs again. Offline delivery may delay removal.

To exclude an old device, delete the synced copy, start a new group, and share the new recovery key only with trusted devices. This cannot erase copies already obtained elsewhere. Keep independent backups: account deletions sync too.

References: [browser storage limits](https://developer.chrome.com/docs/extensions/reference/api/storage), [platform support](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/sync).
