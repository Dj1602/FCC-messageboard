const mongoose = require('mongoose');
const Thread = require('../models/Thread');

module.exports = {
  createThread: async (req, res) => {
    const { board } = req.params;
    const { text, delete_password } = req.body;

    console.log(`[createThread] Received request for board: ${board}`); // Added log
    console.log(`[createThread] Request body: ${JSON.stringify(req.body)}`); // Added log

    try {
      const newThread = new Thread({
        board,
        text,
        delete_password,
        created_on: new Date(),
        bumped_on: new Date(),
        replies: []
      });

      console.log('[createThread] Attempting to save new thread...'); // Added log
      const savedThread = await newThread.save();
      console.log('[createThread] Thread saved successfully:', savedThread._id); // Added log
      res.status(200).json(savedThread);
    }
    catch(err) {
      console.error('[createThread] Error saving thread:', err); // Added log
      res.status(500).send("Error creating thread")
    }
  },
  getThreads: async (req, res) => {
    const { board } = req.params;
    
    try {
      const threads = await Thread.find({ board })
        .sort({bumped_on: -1 })
        .limit(10)
        .select('-delete_password -reported')
        .lean()
      
      const limitedReplies = threads.map(thread => {
        const replies = (thread.replies || [])
          .sort((a, b) => new Date(b.created_on) - new Date(a.created_on))
          .slice(0, 3)
          .map(reply => ({
            _id: reply._id,
            text: reply.text,
            created_on: reply.created_on
          }));
        return {
          ...thread,
          replies
        }
      })
      res.json(limitedReplies)
    }
    catch(err) {
      console.error(err);
      res.status(500).send('Error retrieving threads');
    }
  },
  deleteThread: async (req, res) => {
    const { board } = req.params;
    const { thread_id, delete_password } = req.body;

    try {
      const thread = await Thread.findOne({ _id: thread_id, board });

      if (!thread) {
        return res.status(404).send('Thread not found');
      }

      if (thread.delete_password !== delete_password) {
        return res.status(500).send('incorrect password');
      }

      await Thread.deleteOne({ _id: thread_id });

      return res.status(200).send('success');

    } catch (err) {
      console.error(err);
      return res.status(500).send('Server error');
    }
},

  reportThread: async (req, res) => {
    const { board } = req.params;
    const { thread_id } = req.body;

    try {
      const thread = await Thread.findOneAndUpdate(
        { _id: thread_id, board },
        { reported: true },
        { new: true }
      );

      if (!thread) {
        return res.status(404).send('Thread not found');
      };

      res.send('reported')
    }
    catch(err) {
      console.error(err);
      res.status(500).send('Error reporting thread');
    }
  },
  createReply: async (req, res) => {
    const { board } = req.params;
    const { thread_id, text, delete_password } = req.body;

    try {
      const reply = {
        _id: new mongoose.Types.ObjectId(),
        text,
        delete_password,
        created_on: new Date(),
        reported: false
      };

      const thread = await Thread.findOneAndUpdate(
        { _id: thread_id, board },
        {
          $push: { replies: reply },
          $set: { bumped_on: new Date() }
        },
        { new: true }
      );

      if (!thread) {
        return res.status(404).send('Thread not found');
      }

      res.status(200).json({ status: 'success', reply_id: reply._id });
    } catch (err) {
      console.error(err);
      res.status(500).send('Error creating reply');
    }
  },
  getThreadWithReplies: async (req, res) => {
    const { board } = req.params;
    const { thread_id } = req.query; // For GET requests, parameters are in req.query

    try {
      const thread = await Thread.findOne({ _id: thread_id, board })
        .select('-delete_password -reported') // Exclude thread's sensitive fields
        .lean(); // Use .lean() for plain JavaScript objects, improving performance

      if (!thread) {
        return res.status(404).send('Thread not found');
      }

      // Manually process replies to exclude their sensitive fields (delete_password, reported)
      if (thread.replies && thread.replies.length > 0) {
        thread.replies = thread.replies.map(reply => ({
          _id: reply._id,
          text: reply.text,
          created_on: reply.created_on
          // delete_password and reported are intentionally excluded here
        }));
      } else {
        thread.replies = []; // Ensure replies array exists even if empty
      }

      res.json(thread); // Send the thread object with processed replies

    } catch (err) {
      console.error('Error in getThreadWithReplies:', err);
      // Handle cases where thread_id might be an invalid MongoDB ObjectId format
      if (err.name === 'CastError' && err.path === '_id') {
        return res.status(400).send('Invalid thread_id format');
      }
      res.status(500).send('Error retrieving thread with replies');
    }
  },
  deleteReply: async (req, res) => {
    const { board } = req.params;
    const { thread_id, reply_id, delete_password } = req.body;

    try {
      const thread = await Thread.findOne({ _id: thread_id, board });

      if (!thread) return res.status(404).send('Thread not found');

      const reply = thread.replies.id(reply_id);

      if (!reply) return res.status(404).send('Reply not found');

      if (reply.delete_password !== delete_password) {
        return res.status(403).send('incorrect password');
      }

      reply.text = '[deleted]';
      await thread.save();

      res.send('success');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
    }
  },
  reportReply: async (req, res) => {
    const { board } = req.params;
    const { thread_id, reply_id } = req.body;

    try {
      const thread = await Thread.findOne({ _id: thread_id, board });

      if (!thread) return res.status(404).send('Thread not found');

      const reply = thread.replies.id(reply_id);

      if (!reply) return res.status(404).send('Reply not found');

      reply.reported = true;
      await thread.save();

      res.send('reported');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
    }
  }
};
