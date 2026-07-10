var express = require('express');
var path = require('path');
var router = express.Router();

/* GET home page — serve admin SPA when build exists, otherwise JSON health check */
router.get('/', function(req, res, next) {
  const indexPath = path.resolve(__dirname, '../../client/build/index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.json({ success: true, message: 'Shipone API is running' });
    }
  });
});

module.exports = router;
