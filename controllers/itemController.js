import Item from "../models/Item.js";

export const getItems = async (req, res) => {
  try {
    const items = await Item.findAll({ where: { userId: req.user.id } });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createItem = async (req, res) => {
  try {
    const { name } = req.body;
    const item = await Item.create({ name, userId: req.user.id });
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const item = await Item.findOne({ where: { id, userId: req.user.id } });
    if (!item) return res.status(404).json({ message: "Item not found" });

    item.name = name;
    await item.save();

    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteItem = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await Item.findOne({ where: { id, userId: req.user.id } });
    if (!item) return res.status(404).json({ message: "Item not found" });

    await item.destroy();
    res.json({ message: "Item deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
