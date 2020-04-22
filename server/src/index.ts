exports.options = (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "*");
  res.status(200);
};

exports.post = (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  return { ok: true };
};

exports.get = (req, res) => {
  return "Hello!";
};
