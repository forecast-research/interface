var mongoose = require('mongoose');

module.exports = mongoose.model('Reassigns',
    new mongoose.Schema({
        hitId:          { type: String, required: true },
        assignmentId:   { type: String, required: true },
        oldWorkerId:    { type: String, required: true },
        oldIpAddress:   { type: String, required: true },
        oldUserAgent:   { type: String, required: true },
        oldStartTime:   { type: Date, required: true },
        newWorkerId:    { type: String, required: true },
        newIpAddress:   { type: String, required: true },
        newUserAgent:   { type: String, required: true },
        newStartTime:   { type: Date, required: true },
    }));
