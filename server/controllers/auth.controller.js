const authService = require("../services/auth.service");

exports.register = async (req, res) => {
  const { name, email, password } = req.validated.body;
  const result = await authService.register({ name, email, password });
  res.status(201).json(result);
};

exports.login = async (req, res) => {
  const { email, password } = req.validated.body;
  res.json(await authService.login({ email, password }));
};

exports.getMe = async (req, res) => {
  res.json({ user: authService.toPublicUser(req.user) }); // req.user set by authenticate
};
