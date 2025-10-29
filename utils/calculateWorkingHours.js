const { Op } = require("sequelize");
const { Exception } = require("../models");

async function calculateWorkingHours(startDate, endDate) {
  try {
    if (!startDate || !endDate) {
      throw new Error("startDate and endDate are required");
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      throw new Error("endDate must be after startDate");
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
      return {
        success: true,
        totalWorkingHours: parseFloat(hours.toFixed(2)),
      };
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

    return {
      success: true,
      totalWorkingHours: parseFloat(total.toFixed(2)),
      details: {
        firstDayHours: parseFloat(firstDayHours.toFixed(2)),
        lastDayHours: parseFloat(lastDayHours.toFixed(2)),
        middleDaysHours: parseFloat(middleDaysHours.toFixed(2)),
      },
    };
  } catch (error) {
    console.error("Error calculating working hours:", error);
    return {
      success: false,
      message: error.message || "Error calculating time",
    };
  }
}

module.exports = calculateWorkingHours;

// const result = await calculateWorkingHours("2025-10-28T10:00:00", "2025-10-29T16:00:00");
