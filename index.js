const express = require("express");
const bodyParser = require("body-parser");
require("dotenv").config();

const cors = require("cors");
const cookieParser = require("cookie-parser");

const { sequelize, Exception } = require("./models");
const authRoutes = require("./routes/authRoutes");
const ticketRoutes = require("./routes/ticketRoutes");
const adminRoutes = require("./routes/adminRoutes");
const lookupRoutes = require("./routes/lookup");
const categoryRoutes = require("./routes/categoryRoutes");
const subCategoryRoutes = require("./routes/subCategoryRoutes");
const priorityRoutes = require("./routes/priorityRoutes");
const issueTypeRoutes = require("./routes/issueTypeRoutes");
const slaRoutes = require("./routes/slaRoutes");
const userRoutes = require("./routes/userRoutes");
const systemRoutes = require("./routes/system");
const exceptionRoutes = require("./routes/exceptionRoutes");

const app = express();

// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// ✅ Allow frontend (http://localhost:5173 for Vite)
// app.use(
//   cors({
//     origin: "http://localhost:3000", // frontend URL
//     credentials: true, // ✅ allow cookies
//   })
// );

app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3001"],
    credentials: true,
  })
);

app.post("/api/calculateTime", async (req, res) => {
  try {
    const { start_date_time, end_date_time } = req.body;

    if (!start_date_time || !end_date_time) {
      return res
        .status(400)
        .json({ message: "start_date_time and end_date_time are required" });
    }

    const start = new Date(start_date_time?.includes(".") ? start_date_time?.split(".")[0] : start_date_time);
    const end = new Date(end_date_time?.includes(".") ? end_date_time?.split(".")[0] : end_date_time);

    if (end < start) {
      return res
        .status(400)
        .json({ message: "end_date_time must be after start_date_time" });
    }

    // Default working hours (10 AM - 6 PM)
    const WORK_START_HOUR = 10;
    const WORK_END_HOUR = 18;
    const FULL_DAY_HOURS = 8;

    // Fetch all exceptions between start and end
    const exceptions = await Exception.findAll({
      where: {
        date: {
          [Op.between]: [start, end],
        },
      },
      raw: true,
    });

    // Helper: get exception by date
    const getExceptionForDate = (date) => {
      const dateStr = date.toISOString().split("T")[0]; // 'YYYY-MM-DD'
      return exceptions.find((ex) => ex.date === dateStr);
    };

    // Helper: calculate working hours for a given day
    // const getWorkingHoursForDay = (dateStart, dateEnd, isEndDate = false) => {
    //   const exception = getExceptionForDate(dateStart);

    //   // If it's a holiday
    //   if (!isEndDate && exception && exception.type === "holiday") {
    //     return 0;
    //   }

    //   // Determine work start and end times for this day
    //   const workStart = new Date(dateStart);
    //   const workEnd = new Date(dateStart);

    //   if (exception && exception.open_time && exception.close_time) {
    //     // Apply exception times (e.g., half-day)
    //     const [openHour, openMin] = exception.open_time.split(":").map(Number);
    //     const [closeHour, closeMin] = exception.close_time.split(":").map(Number);
    //     workStart.setHours(openHour, openMin, 0, 0);
    //     workEnd.setHours(closeHour, closeMin, 0, 0);
    //   } else {
    //     // Normal working hours
    //     workStart.setHours(WORK_START_HOUR, 0, 0, 0);
    //     workEnd.setHours(WORK_END_HOUR, 0, 0, 0);
    //   }

    //   const startTime = dateStart > workStart ? dateStart : workStart;
    //   const endTime = isEndDate ? dateEnd : (dateEnd < workEnd ? dateEnd : workEnd);

    //   const diff = (endTime - startTime) / (1000 * 60 * 60);
    //   return diff > 0 ? diff : 0;
    // };
    const getWorkingHoursForDay = (dateStart, dateEnd, isEndDate = false) => {
      const exception = getExceptionForDate(dateStart);

      // If it's a holiday
      if (!isEndDate && exception && exception.type === "holiday") {
        return 0;
      }

      // Determine work start and end times for this day
      const workStart = new Date(dateStart);
      const workEnd = new Date(dateStart);

      if (exception && exception.open_time && exception.close_time) {
        // Apply exception times (e.g., half-day)
        const [openHour, openMin] = exception.open_time.split(":").map(Number);
        const [closeHour, closeMin] = exception.close_time
          .split(":")
          .map(Number);
        workStart.setHours(openHour, openMin, 0, 0);
        workEnd.setHours(closeHour, closeMin, 0, 0);
      } else {
        // Normal working hours
        workStart.setHours(WORK_START_HOUR, 0, 0, 0);
        workEnd.setHours(WORK_END_HOUR, 0, 0, 0);
      }

      const startTime = dateStart > workStart ? dateStart : workStart;
      const endTime = isEndDate
        ? dateEnd
        : dateEnd < workEnd
        ? dateEnd
        : workEnd;

      const diffMs = endTime - startTime;
      if (diffMs <= 0) return 0;

      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      // Convert minutes into decimal (e.g., 30 min → .30)
      return parseFloat(`${hours}.${minutes.toString().padStart(2, "0")}`);
    };

    // --- CASE 1: Same day ---
    if (start.toDateString() === end.toDateString()) {
      const hours = getWorkingHoursForDay(start, end, true);
      return res.json({
        success: true,
        totalWorkingHours: hours.toFixed(2),
      });
    }

    // --- CASE 2: Multiple days ---
    const firstDayEnd = new Date(start);
    firstDayEnd.setHours(23, 59, 59, 999);
    const firstDayHours = getWorkingHoursForDay(start, firstDayEnd);

    const lastDayStart = new Date(end);
    lastDayStart.setHours(0, 0, 0, 0);
    const lastDayHours = getWorkingHoursForDay(lastDayStart, end, true);

    // Days between
    let middleDaysHours = 0;
    const tempDate = new Date(firstDayEnd);
    tempDate.setDate(tempDate.getDate() + 1);

    while (tempDate < lastDayStart) {
      const exception = getExceptionForDate(tempDate);

      if (exception && exception.type === "holiday") {
        // No working hours
        middleDaysHours += 0;
      } else if (exception && exception.open_time && exception.close_time) {
        // Use custom working hour from exception if available
        middleDaysHours += exception.working_hour ?? 0;
      } else {
        // Normal full day
        middleDaysHours += FULL_DAY_HOURS;
      }

      tempDate.setDate(tempDate.getDate() + 1);
    }

    const total = firstDayHours + lastDayHours + middleDaysHours;

    res.json({
      success: true,
      firstDayHours: firstDayHours.toFixed(2),
      lastDayHours: lastDayHours.toFixed(2),
      middleDaysHours: middleDaysHours.toFixed(2),
      totalWorkingHours: total.toFixed(2),
    });
  } catch (error) {
    console.error("Error calculating working hours:", error);
    res.status(500).json({
      success: false,
      message: "Error calculating time",
      error: error.message,
    });
  }
});

// app.post("/api/calculateTime", async (req, res) => {
//   try {
//     const { start_date_time, end_date_time } = req.body;

//     if (!start_date_time || !end_date_time) {
//       return res
//         .status(400)
//         .json({ message: "start_date_time and end_date_time are required" });
//     }

//     const start = new Date(start_date_time);
//     const end = new Date(end_date_time);

//     if (end < start) {
//       return res
//         .status(400)
//         .json({ message: "end_date_time must be after start_date_time" });
//     }

//     // Define working hours (10 AM - 6 PM)
//     const WORK_START_HOUR = 10;
//     const WORK_END_HOUR = 18;
//     const FULL_DAY_HOURS = 8;

//     const exceptions = await Exception.findAll({
//       where: {
//         date: {
//           [Op.between]: [start, end],
//         },
//       },
//       raw: true,
//     });
//     console.log("exceptions", exceptions);

//     const getWorkingHoursForDay = (dateStart, dateEnd, isEndDate = false) => {
//       const workStart = new Date(dateStart);
//       const workEnd = new Date(dateStart);

//       workStart.setHours(WORK_START_HOUR, 0, 0, 0);
//       workEnd.setHours(WORK_END_HOUR, 0, 0, 0);

//       const startTime = dateStart > workStart ? dateStart : workStart;
//       const endTime = isEndDate
//         ? dateEnd
//         : dateEnd < workEnd
//         ? dateEnd
//         : workEnd;

//       const diff = (endTime - startTime) / (1000 * 60 * 60);
//       return diff > 0 ? diff : 0;
//     };

//     if (start.toDateString() === end.toDateString()) {
//       const hours = getWorkingHoursForDay(start, end, true);
//       return res.json({
//         success: true,
//         totalWorkingHours: hours.toFixed(2),
//       });
//     }

//     // First day
//     const firstDayEnd = new Date(start);
//     firstDayEnd.setHours(23, 59, 59, 999);
//     const firstDayHours = getWorkingHoursForDay(start, firstDayEnd);

//     // Last day
//     const lastDayStart = new Date(end);
//     lastDayStart.setHours(0, 0, 0, 0);
//     const lastDayHours = getWorkingHoursForDay(lastDayStart, end, true);

//     // Full days between
//     const fullDaysCount = Math.max(
//       0,
//       Math.floor((lastDayStart - firstDayEnd) / (1000 * 60 * 60 * 24))
//     );

//     // console.log(firstDayHours, lastDayHours, fullDaysCount);

//     const total = firstDayHours + lastDayHours + fullDaysCount * FULL_DAY_HOURS;

//     res.json({
//       success: true,
//       // firstDayHours: firstDayHours.toFixed(2),
//       // lastDayHours: lastDayHours.toFixed(2),
//       // fullDays: fullDaysCount,
//       totalWorkingHours: total.toFixed(2),
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({
//       success: false,
//       message: "Error calculating time",
//       error: error.message,
//     });
//   }
// });

app.get("/api/check", (req, res) => {
  console.log(req.cookies); // should log { token: "..." }
  res.json({ cookies: req.cookies });
});

app.use("/api/admin", userRoutes);
app.use("/api/auth", authRoutes);

app.use("/api/admin/categories", categoryRoutes);
app.use("/api/admin/subcategories", subCategoryRoutes);
app.use("/api/admin/priorities", priorityRoutes);
app.use("/api/admin/issuetypes", issueTypeRoutes);
app.use("/api/admin/slas", slaRoutes);
app.use("/api/ticket", ticketRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/system", systemRoutes);

app.use("/api/admin/exceptions", exceptionRoutes);

// Add this line to your main routes file
app.use("/api/working-hours", require("./routes/workingHours"));

const clientAuthRoutes = require("./routes/clientAuthRoutes");
const clientTicketRoutes = require("./routes/clientTicketRoutes");

// Add these routes after your existing routes
app.use("/api/client/auth", clientAuthRoutes);
app.use("/api/client/tickets", clientTicketRoutes);

// In your main app.js file, add:
const escalationRoutes = require("./routes/escalationRoutes");
app.use("/api/client/escalations", escalationRoutes);

// In your main app.js file, add:
const escalationReportRoutes = require("./routes/escalationReportRoutes");
const { Op } = require("sequelize");
app.use("/api/escalation-reports", escalationReportRoutes);

const clientRoutes = require('./routes/clientRoutes');
app.use('/api/admin/clients', clientRoutes);


app.get("/", (req, res) => res.send("Ticketing system API running"));

app.use((err, req, res, next) => {
  console.error("Unhandled error", err);
  res.status(500).json({ message: "Internal server error" });
});

const PORT = process.env.PORT || 5000;

// sequelize
//   .sync({ alter: false, force: false })
//   .then(() => {
//     console.log("Database synced");
//     app.listen(PORT, () => {
//       console.log(`Server running on port ${PORT}`);
//     });
//   })
//   .catch((err) => {
//     console.error("DB sync error", err);
//   });

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
