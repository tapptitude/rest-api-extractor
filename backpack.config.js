// backpack.config.js
module.exports = {
  webpack: (config, options, webpack) => {
    // new entrypoint
    config.entry.main = ["./src/index.ts"];

    // extensions resolution
    config.resolve = {
      extensions: [".ts", ".js", ".json"]
    };

    // Typescript loader
    config.module.rules.push({
      test: /\.ts$/,
      loader: "ts-loader"
    });

    return config;
  }
};