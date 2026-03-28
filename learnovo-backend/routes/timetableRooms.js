const router = require('express').Router();
const Room = require('../models/Room');
const { authorize } = require('../middleware/auth');
const { validateRoom } = require('../middleware/timetableValidation');
const { handleValidationErrors } = require('../middleware/validation');

// ─── GET / — List rooms ─────────────────────────────────────────────────────
// Filterable by type, isActive
router.get('/', async(req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const filter = { tenantId };

    if (req.query.type) {
      filter.type = req.query.type;
    }
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    } else {
      // Default: show only active rooms
      filter.isActive = true;
    }

    const rooms = await Room.find(filter).sort({ name: 1 }).lean();

    return res.status(200).json({
      success: true,
      data: rooms,
      message: `Found ${rooms.length} room(s)`
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST / — Create room (admin only) ─────────────────────────────────────
router.post('/', authorize('admin'), validateRoom, handleValidationErrors, async(req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { name, code, type, building, floor, capacity, facilities } = req.body;

    // Check for duplicate name within tenant
    const existing = await Room.findOne({ tenantId, name });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `A room with the name "${name}" already exists`
      });
    }

    const room = await Room.create({
      tenantId,
      name,
      code,
      type,
      building,
      floor,
      capacity,
      facilities
    });

    return res.status(201).json({
      success: true,
      data: room,
      message: 'Room created successfully'
    });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /:id — Update room (admin only) ───────────────────────────────────
router.put('/:id', authorize('admin'), validateRoom, handleValidationErrors, async(req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { name, code, type, building, floor, capacity, facilities } = req.body;

    const room = await Room.findOne({ _id: req.params.id, tenantId });
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check for duplicate name (excluding current room)
    if (name && name !== room.name) {
      const existing = await Room.findOne({ tenantId, name, _id: { $ne: room._id } });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: `A room with the name "${name}" already exists`
        });
      }
    }

    if (name !== undefined) room.name = name;
    if (code !== undefined) room.code = code;
    if (type !== undefined) room.type = type;
    if (building !== undefined) room.building = building;
    if (floor !== undefined) room.floor = floor;
    if (capacity !== undefined) room.capacity = capacity;
    if (facilities !== undefined) room.facilities = facilities;

    await room.save();

    return res.status(200).json({
      success: true,
      data: room,
      message: 'Room updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /:id — Soft delete room (admin only) ───────────────────────────
router.delete('/:id', authorize('admin'), async(req, res, next) => {
  try {
    const tenantId = req.user.tenantId;

    const room = await Room.findOne({ _id: req.params.id, tenantId });
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    room.isActive = false;
    await room.save();

    return res.status(200).json({
      success: true,
      data: room,
      message: 'Room deactivated successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
