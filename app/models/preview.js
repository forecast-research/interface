var mongoose = require('mongoose');

module.exports = mongoose.model('Preview',
    new mongoose.Schema({
        hitId:          { type: String, required: true },
        ipAddress:      { type: String, required: true },
        userAgent:      { type: String, required: true },
        workerId:       { type: String, required: false },
        previewTime:    { type: Date, required: true },
    }));
