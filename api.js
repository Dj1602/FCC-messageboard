'use strict';
const threadController = require('../controllers/threadController');

module.exports = function (app) {

  app.route('/api/threads/:board')
    .post(threadController.createThread)
    .get(threadController.getThreads)
    .delete(threadController.deleteThread)
    .put(threadController.reportThread);

  app.route('/api/replies/:board')
    .post(threadController.createReply)
    .get(threadController.getThreadWithReplies)
    .delete(threadController.deleteReply)
    .put(threadController.reportReply);

};
