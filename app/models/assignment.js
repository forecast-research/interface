var mongoose = require('mongoose');

module.exports = mongoose.model(
  "Assignment",
  new mongoose.Schema({
    _id: { type: String, required: true },
    _hitId: { type: String, required: true },
    workerId: { type: String, required: true },
    ipAddress: { type: String, required: true },
    userAgent: { type: String, required: true },
    condition: { type: String, required: true },
    startTime: { type: Date, required: true },
    completionTime: { type: Date, required: false },
    token: { type: String, required: false },
    tasks: { type: Array, required: false },
    score: [{ type: Number, required: false }],
    values: [[{ type: Number }]],
    predictions: [[{ type: Number }]],
    longRunningAveragePredHist: [[{ type: Number }]],
    longRunningAveragePredTimingHist: [[{ type: Number }]],
    validation: [{ type: Boolean }],
    consentTime: { type: Number },
    instructionTime: { type: Number },
    predictionTimes: [[{ type: Number }]],
    experimentTime: { type: Number },
    surveyTime: { type: Number },
    surveyData: [{ type: String }],
  })
);
