'use strict';

const mongoose = require('mongoose');

const calendarEventSchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    type: { type: String, enum: ['inspection', 'move_in', 'rent_review', 'maint'] },
    title: { type: String },
    start: { type: Date },
    end: { type: Date },
    relatedRef: { type: String },
    reminders: { type: [Date], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CalendarEvent', calendarEventSchema);
