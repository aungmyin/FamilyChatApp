const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema(
  {
    room: {
      type: String,
      required: true,
      enum: ['general', 'family', 'random'],
    },
    author: {
      type: String,
      required: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    clientMessageId: {
      type: String,
      index: true,
      sparse: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 2000,
    },
    time: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

// Compound index for message deduplication
MessageSchema.index({ clientMessageId: 1, authorId: 1 }, { sparse: true });

module.exports = mongoose.model('Message', MessageSchema);
