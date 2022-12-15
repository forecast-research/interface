const CopyPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");

const html = Object.entries({
  "admin/pages/approve-hit": ['price-helpers'],
  "admin/pages/check-balance": [],
  "admin/pages/conditions": ['conditions'],
  "admin/pages/create-hit": [],
  "admin/index": [],
  "admin/pages/list-hits": [],
  "admin/pages/local-experiment": [],
  "admin/pages/show-assignment": ['price-helpers'],
  "admin/pages/show-hit": ['price-helpers'],
  "admin/pages/test-simulator": [],
  "index": ['index'],
  "experiment": ['launcher'],
}).map(([name, chunks]) => {
  return new HtmlWebpackPlugin({
    filename: `./${name}.html`,
    template: `./client/${name}.html`,
    chunks,
  });
});

module.exports = {
  devtool: "inline-source-map",
  mode: process.env.NODE_ENV === "production" ? "production" : "development",
  entry: {
    index: "./client/js/index.js",
    conditions: "./client/js/conditions.js",
    launcher: "./client/js/launcher.js",
    'price-helpers': "./client/js/price-helpers.js",
  },
  plugins: [
    ...html,
    new CopyPlugin({
      patterns: [{ from: "client/assets", to: "assets" }],
    }),
  ],
  output: {
    filename: "[name].[contenthash].js",
    clean: true,
  },
};
