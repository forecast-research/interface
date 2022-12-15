const typeMappings = {
  rho: Number,
  mu: Number,
  sigma: Number,
  seed: String,
  bonusDivisor: Number,
  trainingRounds: Number,
  testingRounds: Number,
  entryMode: String,
  forecastMode: String,
  showGrayDots: Boolean,
  colorDecay: Number,
  listeningMaterial: Boolean,
  showMean: Boolean,
  clickt: Boolean,
  clickt10: Boolean,
  context: String,
  fadeDistant: Boolean,
  processInfo: String,
  predictLongRunning: Boolean,
};

const defaultValues = {
  rho: null,
  mu: 0,
  sigma: 20,
  seed: "",
  bonusDivisor: 750,
  trainingRounds: 0,
  testingRounds: 40,
  entryMode: "graphical",
  forecastMode: "1+2",
  showGrayDots: true,
  colorDecay: 1,
  listeningMaterial: true,
  showMean: true,
  clickt: true,
  clickt10: true,
  context: "",
  fadeDistant: false,
  processInfo: "",
  predictLongRunning: false,
};

function parseValue(field, value) {
  const type = typeMappings[field];
  if (type === Boolean) {
    return value === "true" || value === "1"
  }
  if (type === Number) {
    return parseFloat(value);
  }
  return value;
}

module.exports.getPreview = function getPreview() {
  return {
    ...getDefaults(),
    preview: true,
    colorDecay: 0,
    listeningMaterial: false,
    clickt: false,
    clickt10: false,
  };
}

module.exports.applyDefaults = function applyDefaults (to) {
  const defaults = getDefaults();
  applyConditionObj(defaults, to);
}

module.exports.applyConditionObj = function applyConditionObj (from, to) {
  Object.keys(from)
    .filter((key) => key in typeMappings)
    .forEach((key) => {
      to[key] = from[key];
    });
}

module.exports.getDefaults = function getDefaults() {
  return defaultValues;
}

module.exports.getFromQueryString = function getFromQueryString() {
  const queryString = window.location.search.substring(1);
  const queryStringValues = queryString.split('&');
  const queryStringObject = {};
  queryStringValues.forEach((value) => {
    const [key, val] = value.split('=');
    if (key in typeMappings) {
      queryStringObject[key] = parseValue(key, decodeURIComponent(val));
      if (queryStringObject[key] == null || queryStringObject[key] !== queryStringObject[key]) {
        queryStringObject[key] = defaultValues[key];
      }
    }
  });
  return [queryStringObject];
}

module.exports.toQueryString = function toQueryString(values) {
  return Object.keys(values)
    .filter(key => key in typeMappings)
    .map(
      (key) =>
        `${key}=${encodeURIComponent(
          values[key] == null ? defaultValues[key] : values[key]
        )}`
    )
    .join("&");
}

module.exports.getTasks = function getTasks(condition, randomize = true) {
  function randomRHO () {
    const pValues = [0, 0.2, 0.4, 0.6, 0.8, 1];
    var randId = Math.floor(Math.random() * Math.floor(pValues.length));
    return pValues[randId];
  }

  const randomRhoValue = randomRHO();

  return condition.reduce(
    (acc, curr) => [
      ...acc,
      {
        ...(acc[acc.length - 1] ?? {}),
        ...curr,
        rho: curr.rho == null && randomize ? randomRhoValue : curr.rho,
      },
    ],
    [{
      ...module.exports.getDefaults(),
    }]
  ).slice(1);
}