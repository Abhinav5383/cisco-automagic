## Setup Instructions

### 1. `.env` setup

Create a `.env` file in the project's root with the follwing variables set
```ini
USERNAME=""
PASSWORD=""
COURSE_BTN_ID=""

CHROMIUM_PATH=""
```

To get the `COURSE_BTN_ID`:
- Go to https://netacad.com/dashboard (make sure you're logged in)
- Open devtools (`ctrl + shift + i` or `F12`)
- Select the course card with the element selector, You may need to look into it's child elements but you'll find an `id` attribute with the same name as the course's.

For the `CHROMIUM_PATH`:
- Go to https://ungoogled-software.github.io/ungoogled-chromium-binaries and download the one for your OS.
- Extract the archive somewhere and copy the path of the folder
- Set `CHROMIUM_PATH` to `<COPIED_PATH>/chrome`

NOTE: Windows uses `\` instead of `/` in paths so keep that in mind


### 2. Install runtime and project dependencies
- Install [bun](https://bun.sh/).
- Open the project folder in terminal and run `bun install`.

That is all, I think

Now run the bot with `bun run start`
