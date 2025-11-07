const { Op } = require("sequelize");
const { Exception } = require("../models");

async function calculateCompletionTime(start_date_time, sla_time) {
  try {
    if (!start_date_time || sla_time === undefined) {
      throw new Error("start_date_time and sla_time are required");
    }

    const start = new Date(
      start_date_time?.includes(".")
        ? start_date_time?.split(".")[0]
        : start_date_time
    );

    if (isNaN(start)) {
      throw new Error("Invalid start_date_time");
    }

    // Default working hours
    const WORK_START_HOUR = 10;
    const WORK_END_HOUR = 18;
    const FULL_DAY_HOURS = 8;

    // Get all exceptions from start to a reasonable future window (e.g., 1 month ahead)
    const endEstimate = new Date(start);
    endEstimate.setDate(endEstimate.getDate() + 30);

    const exceptions = await Exception.findAll({
      where: {
        date: {
          [Op.between]: [start, endEstimate],
        },
      },
      raw: true,
    });

    // Helper: get exception for a given date
    const getExceptionForDate = (date) => {
      const dateStr = date.toISOString().split("T")[0];
      return exceptions.find((ex) => ex.date === dateStr);
    };

    // Function: get working window (start & end) for a specific date
    const getWorkingWindow = (date) => {
      const exception = getExceptionForDate(date);
      const workStart = new Date(date);
      const workEnd = new Date(date);

      if (exception && exception.type === "holiday") {
        return null; // No working hours
      }

      if (exception && exception.open_time && exception.close_time) {
        const [openHour, openMin] = exception.open_time.split(":").map(Number);
        const [closeHour, closeMin] = exception.close_time.split(":").map(Number);
        workStart.setHours(openHour, openMin, 0, 0);
        workEnd.setHours(closeHour, closeMin, 0, 0);
      } else {
        workStart.setHours(WORK_START_HOUR, 0, 0, 0);
        workEnd.setHours(WORK_END_HOUR, 0, 0, 0);
      }

      return { workStart, workEnd };
    };

    // Helper: format date as "YYYY-MM-DDTHH:mm:ss±HH:MM"
    function formatWithOffset(date) {
      const pad = (n) => String(n).padStart(2, "0");

      const year = date.getFullYear();
      const month = pad(date.getMonth() + 1);
      const day = pad(date.getDate());
      const hours = pad(date.getHours());
      const mins = pad(date.getMinutes());
      const secs = pad(date.getSeconds());

      const tzMin = -date.getTimezoneOffset(); // e.g. IST = +330
      const sign = tzMin >= 0 ? "+" : "-";
      const tzHours = pad(Math.floor(Math.abs(tzMin) / 60));
      const tzMinutes = pad(Math.abs(tzMin) % 60);

      return `${year}-${month}-${day}T${hours}:${mins}:${secs}${sign}${tzHours}:${tzMinutes}`;
    }

    let remainingHours = Number(sla_time);
    let current = new Date(start);

    // Loop day by day until SLA time is completed
    while (remainingHours > 0) {
      const workingWindow = getWorkingWindow(current);

      if (!workingWindow) {
        // Skip holidays
        current.setDate(current.getDate() + 1);
        current.setHours(0, 0, 0, 0);
        continue;
      }

      const { workStart, workEnd } = workingWindow;
      const effectiveStart = current > workStart ? current : workStart;
      const diffMs = workEnd - effectiveStart;

      if (diffMs > 0) {
        const availableHours = diffMs / (1000 * 60 * 60);

        if (availableHours >= remainingHours) {
          const completionTime = new Date(
            effectiveStart.getTime() + remainingHours * 3600 * 1000
          );

          return {
            success: true,
            start_date_time,
            sla_time,
            completion_date_time_local: formatWithOffset(completionTime),
          };
        } else {
          // Consume full working hours of this day and continue
          remainingHours -= availableHours;
        }
      }

      // Move to next day
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
    }

    return {
      success: true,
      message: "SLA time exceeded possible working window range",
    };
  } catch (error) {
    console.error("Error calculating completion time:", error);
    return {
      success: false,
      message: "Error calculating completion time",
      error: error.message,
    };
  }
}

module.exports = { calculateCompletionTime };
