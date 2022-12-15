var mongoose = require('mongoose');

module.exports = mongoose.model('HIT',
    new mongoose.Schema({
        _id:            { type: String, required: true },
        title:          { type: String, required: true },
        description:    { type: String, required: true },
        internalName:   { type: String, required: true },
        lifetime:       { type: Number, required: true },
        duration:       { type: Number, required: true },
        assignments:    { type: Number, required: true },
        conditions:     [{ type: String, required: true }],
        sandbox:        { type: Boolean, required: true },
        creationTime:   { type: Date, required: true },
        basePayment:    { type: Number, required: true },
    }));
