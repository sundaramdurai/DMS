// Temporal boundary engine with 4AM pivot logic
const TemporalBoundaryEngine = (() => {
  const PIVOT_HOUR = 4;
  const MILLISEC_PER_MIN = 60000;
  const MINS_PER_HOUR = 60;
  const HOURS_PER_DAY = 24;

  const deriveWorkdayAnchor = (timestampMs) => {
    const momentObj = new Date(timestampMs);
    const currentHour = momentObj.getHours();
    
    const anchorDate = new Date(momentObj);
    anchorDate.setHours(PIVOT_HOUR, 0, 0, 0);
    
    if (currentHour < PIVOT_HOUR) {
      anchorDate.setDate(anchorDate.getDate() - 1);
    }
    
    return anchorDate.toISOString().split('T')[0];
  };

  const convertMsToMinutesOnly = (milliseconds) => {
    return Math.floor(milliseconds / MILLISEC_PER_MIN);
  };

  const formatMinutesToDisplay = (totalMinutes) => {
    const hourSegment = Math.floor(totalMinutes / MINS_PER_HOUR);
    const minuteSegment = totalMinutes % MINS_PER_HOUR;
    return `${String(hourSegment).padStart(2, '0')}:${String(minuteSegment).padStart(2, '0')}`;
  };

  const extractCurrentTimestamp = () => Date.now();

  const calculateMinuteSpan = (startMs, endMs) => {
    return convertMsToMinutesOnly(endMs - startMs);
  };

  return {
    deriveWorkdayAnchor,
    convertMsToMinutesOnly,
    formatMinutesToDisplay,
    extractCurrentTimestamp,
    calculateMinuteSpan
  };
})();
