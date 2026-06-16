# Store Assets

Chrome Web Store screenshots and promo tiles are listing assets, not extension package files. Upload the PNGs in `screenshots/` and `promotional/` manually in the developer dashboard.

Regenerate them with:

```sh
npm run store:screenshots
```

The screenshots use synthetic demo accounts and are generated from the built app in a real browser at `1280x800`. Promo tiles are generated at `440x280` and `1400x560`.
