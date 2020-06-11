# Rest API Extractor

## About

Extract endpoint informations from your [Express](https://github.com/expressjs/express) API written in Typescript.

This project makes use of the [TSQuery library](https://github.com/phenomnomnominal/tsquery) in order to extract and parse data from typescript files. To see how to use TSQuery, head over to their [github page](https://github.com/phenomnomnominal/tsquery) or check out what it does [on the playground](https://tsquery-playground.firebaseapp.com/)!

## Features

- Pretty prints to console the endpoints with body params, query params and used headers
- Generates a Postman collection with all the endpoints

## Requirements

- NodeJS 10+
- Npm

## Installation

```sh
# Install the required packages
npm install

# Optional install ts-node globally to use standalone
npm install -g ts-node
```

## Running the application

Simple run using npm scripts:
```sh
npm start ~/path/server.ts
```

Run with options using npm scripts:
```sh
npm start -- ~/path/server.ts --print --postman "My API Collection"
```

Run standalone with ts-node:
```sh
ts-node src/index.ts ~/path/server.ts --print --postman "My API Collection"
```

Check out the script parameters and other informations:
```sh
ts-node src/index.ts --help
```

## Building

Bundling of the app is handled by [backpack](https://github.com/jaredpalmer/backpack):
```sh
# This will generate /build/main.js
npm run build
```

After building you can run it using node:
```sh
node build/main.js --help
```

## Status

This project is in a **work in progress** state. Any changes might and probablly will change the output and behaviour of the app.

## Contribution

Feel free to Fork, submit Pull Requests or send us your feedback and suggestions!

## License 

Rest-api-extractor is available under the Apache License Version 2.0. See the LICENSE file for more info.