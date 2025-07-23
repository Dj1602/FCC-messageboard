const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
  text: String,
  created_on: { type: Date, default: Date.now },
  delete_password: String,
  reported: { type: Boolean, default: false }
});

const threadSchema = new mongoose.Schema({
  board: String,
  text: String,
  created_on: { type: Date, default: Date.now },
  bumped_on: { type: Date, default: Date.now },
  reported: { type: Boolean, default: false },
  delete_password: String,
  replies: [replySchema]
});

const replies= new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  text: String,
  delete_password: String,
  created_on: Date,
  reported: Boolean
})


module.exports = mongoose.model('Thread', threadSchema);
