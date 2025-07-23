const mongoose = require('mongoose');
const chaiHttp = require('chai-http');
const chai = require('chai');
const assert = chai.assert;
const server = require('../server');

chai.use(chaiHttp);

let threadIdForReply; // Used for reply tests (test 6, 7)
let deleteThreadId;   // Used for thread deletion tests (test 3, 4)
let reportThreadId;   // Used for thread reporting tests (test 5)
let threadIdForReplyDeletionReporting; // <-- ADD THIS NEW GLOBAL VARIABLE
let replyIdForDeletion; // Used for reply deletion tests (test 8, 9)
let replyIdForReporting; // Used for reply reporting tests (test 10)


describe('Functional Tests', function() {

    // BEFORE ALL HOOKS for setting up threads needed for subsequent tests
    before(function (done) {
        // Setup for threadIdForReply (already present and correct)
        chai.request(server)
            .post('/api/threads/testboard')
            .send({
                text: 'Thread for reply test',
                delete_password: 'testpass'
            })
            .end((err, res) => {
                if (err) return done(err);
                assert.equal(res.status, 200, 'Expected 200 status for thread creation for reply test');
                assert.property(res.body, '_id', 'Expected _id in response from thread creation for reply test');
                threadIdForReply = res.body._id;

                // Setup for deleteThreadId
                chai.request(server)
                    .post('/api/threads/deleteboard')
                    .send({
                        text: 'Thread to delete',
                        delete_password: 'deletepass'
                    })
                    .end((err, res) => {
                        if (err) return done(err);
                        assert.equal(res.status, 200, 'Expected 200 status for thread creation for deletion test');
                        assert.property(res.body, '_id', 'Expected _id in response from thread creation for deletion test');
                        deleteThreadId = res.body._id;

                        // Setup for reportThreadId
                        chai.request(server)
                            .post('/api/threads/reportboard')
                            .send({
                                text: 'thread to report',
                                delete_password: 'reportpass'
                            })
                            .end((err, res) => {
                                if (err) return done(err);
                                assert.equal(res.status, 200, 'Expected 200 status for thread creation for reporting test');
                                assert.property(res.body, '_id', 'Expected _id in response from thread creation for reporting test');
                                reportThreadId = res.body._id;

                                // Setup for reply deletion and reporting tests (create a thread and a reply)
                                chai.request(server)
                                    .post('/api/threads/replytestboard')
                                    .send({
                                        text: 'Thread for reply deletion/reporting test',
                                        delete_password: 'replytestpass'
                                    })
                                    .end((err, res) => {
                                        if (err) return done(err);
                                        const threadIdForReplyTests = res.body._id;
                                        threadIdForReplyDeletionReporting = threadIdForReplyTests;
                                        chai.request(server)
                                            .post('/api/replies/replytestboard')
                                            .send({
                                                thread_id: threadIdForReplyTests,
                                                text: 'Reply for deletion/reporting test',
                                                delete_password: 'replydelreportpass'
                                            })
                                            .end((err, res) => {
                                                if (err) return done(err);
                                                // After creating the reply, GET the thread to get the reply's _id
                                                chai.request(server)
                                                    .get(`/api/replies/replytestboard?thread_id=${threadIdForReplyTests}`)
                                                    .end((err, res) => {
                                                        if (err) return done(err);
                                                        assert.equal(res.status, 200);
                                                        assert.isObject(res.body);
                                                        assert.isArray(res.body.replies);
                                                        assert.isAtLeast(res.body.replies.length, 1);
                                                        replyIdForDeletion = res.body.replies[0]._id;
                                                        replyIdForReporting = res.body.replies[0]._id;
                                                        done(); // All setup complete
                                                    });
                                            });
                                    });
                            });
                    });
            });
    });

    // --- 1. Creating a new thread ---
    it('Creating a new thread: POST request to /api/threads/{board}', function(done) {
        chai
            .request(server)
            .post('/api/threads/my-board')
            .send({
                text: 'My first board',
                delete_password: 'test_123'
            })
            .end((err, res) => {
                assert.equal(res.status, 200);
                assert.property(res.body, 'text');
                assert.equal(res.body.text, 'My first board');
                done();
            });
    });

    // --- 2. Viewing the 10 most recent threads ---
    it('Viewing the 10 most recent threads with 3 replies each: GET request to /api/threads/{board}', function(done) {
        chai
            .request(server)
            .get('/api/threads/testboard')
            .end((err, res) => {
                assert.equal(res.status, 200);
                assert.isArray(res.body);
                assert.isAtMost(res.body.length, 10);

                res.body.forEach(thread => {
                    assert.property(thread, '_id');
                    assert.property(thread, 'created_on');
                    assert.property(thread, 'bumped_on');
                    assert.property(thread, 'text');
                    assert.property(thread, 'replies');
                    assert.isArray(thread.replies);
                    assert.isAtMost(thread.replies.length, 3); // Max 3 replies

                    thread.replies.forEach(reply => {
                        assert.property(reply, '_id');
                        assert.property(reply, 'text');
                        assert.property(reply, 'created_on');
                        assert.notProperty(reply, 'delete_password');
                        assert.notProperty(reply, 'reported');
                    });
                });
                done();
            });
    });

    // --- 3. Deleting a thread with incorrect password ---
    it('Deleting a thread with the incorrect password: DELETE request to /api/threads/{board} with an invalid delete_password', function(done) {
        chai.request(server)
            .delete('/api/threads/deleteboard')
            .send({
                thread_id: deleteThreadId,
                delete_password: 'wrongpass'
            })
            .end((err, res) => {
                assert.equal(res.status, 500); // Check your API's status code for incorrect password
                assert.equal(res.text, 'incorrect password');
                done();
            });
    });

    // --- 4. Deleting a thread with correct password ---
    it('Deleting a thread with the correct password: DELETE request to /api/threads/{board} with a valid delete_password', function(done) {
        chai.request(server)
            .delete('/api/threads/deleteboard')
            .send({
                thread_id: deleteThreadId,
                delete_password: 'deletepass'
            })
            .end((err, res) => {
                assert.equal(res.status, 200);
                assert.equal(res.text, 'success');
                done();
            });
    });

    // --- 5. Reporting a thread ---
    it('Reporting a thread: PUT request to /api/threads/{board}', function(done) {
        chai
            .request(server)
            .put('/api/threads/reportboard')
            .send({
                thread_id: reportThreadId
            })
            .end((err, res) => {
                assert.equal(res.status, 200);
                assert.equal(res.text, 'reported');
                done();
            });
    });

    // --- 6. Creating a new reply ---
    it('You can send a POST request to /api/replies/{board} with form data including text, delete_password, & thread_id. This will update the bumped_on date to the comment\'s date. In the thread\'s replies array, an object will be saved with at least the properties _id, text, created_on, delete_password, & reported.', function (done) {
        chai
            .request(server)
            .post('/api/replies/testboard')
            .send({
                thread_id: threadIdForReply,
                text: 'Test reply',
                delete_password: 'replypass'
            })
            .end((err, res) => {
                assert.equal(res.status, 200);
                done();
            });
    });

    // --- 7. Viewing a single thread with all replies ---
    it('Viewing a single thread with all replies: GET request to /api/replies/{board}', function (done) {
        chai
            .request(server)
            .get('/api/replies/testboard')
            .query({ thread_id: threadIdForReply })
            .end((err, res) => {
                assert.equal(res.status, 200);
                assert.isObject(res.body);
                assert.property(res.body, 'replies');
                assert.isArray(res.body.replies);
                done();
            });
    });

    // --- 8. Deleting a reply with incorrect password ---
    it('Deleting a reply with the incorrect password: DELETE request to /api/replies/{board} with an invalid delete_password', function(done) {
        chai.request(server)
            .delete('/api/replies/replytestboard')
            .send({
                thread_id: threadIdForReplyDeletionReporting, // Use the thread associated with the reply
                reply_id: replyIdForDeletion,
                delete_password: 'wrongreplypass'
            })
            .end((err, res) => {
                assert.equal(res.status, 403); // Assuming your API returns 403 for incorrect reply password
                assert.equal(res.text, 'incorrect password');
                done();
            });
    });

    // --- 9. Deleting a reply with correct password ---
    it('Deleting a reply with the correct password: DELETE request to /api/replies/{board} with a valid delete_password', function(done) {
        chai.request(server)
            .delete('/api/replies/replytestboard')
            .send({
                thread_id: threadIdForReplyDeletionReporting,
                reply_id: replyIdForDeletion, // Use the same reply ID for deletion
                delete_password: 'replydelreportpass'
            })
            .end((err, res) => {
                assert.equal(res.status, 200);
                assert.equal(res.text, 'success');
                done();
            });
    });

    // --- 10. Reporting a reply ---
    it('Reporting a reply: PUT request to /api/replies/{board}', function(done) {
        chai.request(server)
            .put('/api/replies/replytestboard')
            .send({
                thread_id: threadIdForReplyDeletionReporting,
                reply_id: replyIdForReporting
            })
            .end((err, res) => {
                assert.equal(res.status, 200);
                assert.equal(res.text, 'reported');
                done();
            });
    });

    // AFTER ALL HOOK for cleaning up
    after(async function() {
        try {
            if (mongoose.connection && mongoose.connection.readyState === 1) {
                console.log("Closing MongoDB connection from tests...");
                await mongoose.connection.close();
                console.log("MongoDB connection closed from tests.");
            } else {
                console.log("No active MongoDB connection to close from tests.");
            }
        } catch (err) {
            console.error("Error closing MongoDB connection from tests:", err);
        }
    });
});
