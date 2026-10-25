# What's this?
A personalised dashboard for you built with HTML, JS and CSS. It is called **Terra**, and it lives entirely in your browser - no accounts, no backend, no build step.

Right now it can:
- greet you by name (the one thing it asks you for)
- run a Pomodoro focus timer with a circular progress ring
- keep a list of goals you can tick off
- show the weather, from Open-Meteo, no API key needed
- hold events in a little calendar panel
- pull your stats out of Hackatime through OAuth
- let you drag and resize every panel, and remember where you put them

> [!WARNING]
> This project is not meant to be continued (subject to my decisions), and will be archived soon.
> This was always meant to be a weekly project for Hack Club.

## Installation
Relatively easy to install - that is if you're a programmer.

### Requirements
Needs git and a basic code editor. A modern browser helps too, since Terra uses ES modules, `localStorage` and service workers - opening `index.html` straight off your disk (`file://`) will not work, the browser will block the modules. So clone it, then serve the folder:

```bash
git clone <this-repo>
cd terra-dashboard
python3 -m http.server 8000
```

Then visit `http://localhost:8000`. Any static server will do (`npx serve`, GitHub Pages, Neocities, whatever you already have lying around) - just keep it on `localhost` or HTTPS, otherwise the service worker won't register and you lose the offline caching.

No dependencies, no `npm install`, nothing to compile. The whole thing is plain files.

### Configuration
Nothing required. Three things worth knowing anyway:
- Hackatime integration is not available currently due to CORS issues. To fix, I would have to call Hackatime API from my own API backend, which I have decided I would not commit due to hosting costs and the scale of this. I'm still accepting contributions via PRs.
- The weather panel asks for a location through the browser's geolocation prompt; deny it and it will tell you "Location permission denied." and leave you alone.
- The Hackatime panel needs you to sign in with your Hack Club account before it shows anything. The client ID in `js/hackatime.js` is public by design (it is not a secret), so there is nothing for you to fill in.

## Contributing
First of all, thank you for your contribution(s). Please do not include any "big" features without discussing with me first, small changes (such as colour changes, or small improvements) are acceptable. Always test the app with your code before you make a pull request. I do not mind AI assistance, however purely AI generated code without human involvement is prohibited.

A few notes on the shape of the codebase, so you don't fight it: each widget is its own file in `js/` and is imported once from `js/app.js`, shared helpers live in `utils/`, and everything that needs to survive a refresh goes through `js/storage.js` rather than poking `localStorage` directly. Styles are all in `css/index.css` - there is no framework, and I would like it to stay that way.

## License
MIT, see `LICENSE`.