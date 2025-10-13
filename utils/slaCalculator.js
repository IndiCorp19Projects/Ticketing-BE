class SLACalculator {
  /**
   * Calculate due date based on working hours
   * @param {Date} startDate - When the timer starts
   * @param {number} targetMinutes - Target time in minutes
   * @param {Object} workingHours - Working hours configuration
   * @returns {Date} Due date
   */
  static calculateDueDate(startDate, targetMinutes, workingHours) {
    if (!workingHours) {
      // Fallback: add minutes without considering working hours
      return new Date(startDate.getTime() + targetMinutes * 60000);
    }

    let currentTime = new Date(startDate);
    let remainingMinutes = targetMinutes;

    while (remainingMinutes > 0) {
      // Check if current day is a working day
      if (this.isWorkingDay(currentTime, workingHours.working_days)) {
        const dayWorkingMinutes = this.getWorkingMinutesForDay(currentTime, workingHours);
        
        if (dayWorkingMinutes > 0) {
          const minutesToUse = Math.min(remainingMinutes, dayWorkingMinutes);
          currentTime = this.addWorkingMinutes(currentTime, minutesToUse, workingHours);
          remainingMinutes -= minutesToUse;
        } else {
          // Move to next working day start
          currentTime = this.getNextWorkingDayStart(currentTime, workingHours);
        }
      } else {
        // Move to next working day start
        currentTime = this.getNextWorkingDayStart(currentTime, workingHours);
      }
    }

    return currentTime;
  }

  /**
   * Check if a date falls on a working day
   */
  static isWorkingDay(date, workingDaysBitmask) {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const dayBit = Math.pow(2, dayOfWeek);
    return (workingDaysBitmask & dayBit) !== 0;
  }

  /**
   * Get available working minutes for a specific day
   */
  static getWorkingMinutesForDay(date, workingHours) {
    if (!this.isWorkingDay(date, workingHours.working_days)) {
      return 0;
    }

    const startTime = new Date(date);
    const [startHours, startMinutes] = workingHours.start_time.split(':').map(Number);
    startTime.setHours(startHours, startMinutes, 0, 0);

    const endTime = new Date(date);
    const [endHours, endMinutes] = workingHours.end_time.split(':').map(Number);
    endTime.setHours(endHours, endMinutes, 0, 0);

    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);

    const currentTime = new Date(date);

    // If before working hours, use full working day
    if (currentTime < startTime) {
      return (endTime - startTime) / (1000 * 60);
    }

    // If after working hours, no time left today
    if (currentTime >= endTime) {
      return 0;
    }

    // If during working hours, calculate remaining time
    return (endTime - currentTime) / (1000 * 60);
  }

  /**
   * Add working minutes to a date
   */
  static addWorkingMinutes(date, minutes, workingHours) {
    const result = new Date(date);
    const [startHours, startMinutes] = workingHours.start_time.split(':').map(Number);
    const [endHours, endMinutes] = workingHours.end_time.split(':').map(Number);

    let remainingMinutes = minutes;

    while (remainingMinutes > 0) {
      if (!this.isWorkingDay(result, workingHours.working_days)) {
        result.setDate(result.getDate() + 1);
        result.setHours(startHours, startMinutes, 0, 0);
        continue;
      }

      const currentTime = result.getHours() * 60 + result.getMinutes();
      const dayStartMinutes = startHours * 60 + startMinutes;
      const dayEndMinutes = endHours * 60 + endMinutes;

      // If before working hours, jump to start
      if (currentTime < dayStartMinutes) {
        result.setHours(startHours, startMinutes, 0, 0);
        continue;
      }

      // If after working hours, jump to next day
      if (currentTime >= dayEndMinutes) {
        result.setDate(result.getDate() + 1);
        result.setHours(startHours, startMinutes, 0, 0);
        continue;
      }

      const minutesLeftToday = dayEndMinutes - currentTime;
      const minutesToAdd = Math.min(remainingMinutes, minutesLeftToday);

      result.setMinutes(result.getMinutes() + minutesToAdd);
      remainingMinutes -= minutesToAdd;

      // If we've reached end of day and still have minutes left, move to next day
      if (remainingMinutes > 0) {
        result.setDate(result.getDate() + 1);
        result.setHours(startHours, startMinutes, 0, 0);
      }
    }

    return result;
  }

  /**
   * Get the start of the next working day
   */
  static getNextWorkingDayStart(date, workingHours) {
    let nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(0, 0, 0, 0);

    const [startHours, startMinutes] = workingHours.start_time.split(':').map(Number);

    while (!this.isWorkingDay(nextDay, workingHours.working_days)) {
      nextDay.setDate(nextDay.getDate() + 1);
    }

    nextDay.setHours(startHours, startMinutes, 0, 0);
    return nextDay;
  }

  /**
   * Calculate actual working minutes between two dates
   */
  static getWorkingMinutesBetween(startDate, endDate, workingHours) {
    if (!workingHours) {
      return (endDate - startDate) / (1000 * 60);
    }

    let current = new Date(startDate);
    let totalWorkingMinutes = 0;

    while (current < endDate) {
      if (this.isWorkingDay(current, workingHours.working_days)) {
        const dayEnd = new Date(current);
        const [endHours, endMinutes] = workingHours.end_time.split(':').map(Number);
        dayEnd.setHours(endHours, endMinutes, 0, 0);

        const dayStart = new Date(current);
        const [startHours, startMinutes] = workingHours.start_time.split(':').map(Number);
        dayStart.setHours(startHours, startMinutes, 0, 0);

        // Adjust for partial days
        const segmentStart = current > dayStart ? current : dayStart;
        const segmentEnd = endDate < dayEnd ? endDate : dayEnd;

        if (segmentStart < segmentEnd) {
          totalWorkingMinutes += (segmentEnd - segmentStart) / (1000 * 60);
        }
      }

      // Move to next day
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
    }

    return totalWorkingMinutes;
  }
}

module.exports = SLACalculator;