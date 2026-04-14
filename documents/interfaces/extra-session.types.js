"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXAMPLE_UPDATE_WEEKLOG_EXTRASESSION_PAYLOAD = exports.EXTRA_SESSION_DISCIPLINES = exports.ExtraSessionCategory = void 0;
exports.calculateCalories = calculateCalories;
exports.isValidCaloriesOverride = isValidCaloriesOverride;
var ExtraSessionCategory;
(function (ExtraSessionCategory) {
    ExtraSessionCategory["CARDIO"] = "cardio";
    ExtraSessionCategory["STRENGTH"] = "strength";
    ExtraSessionCategory["SPORT"] = "sport";
    ExtraSessionCategory["MIND_BODY"] = "mind_body";
})(ExtraSessionCategory || (exports.ExtraSessionCategory = ExtraSessionCategory = {}));
exports.EXTRA_SESSION_DISCIPLINES = {
    running: { key: 'running', label: 'Running', category: ExtraSessionCategory.CARDIO, met: 8 },
    cycling: { key: 'cycling', label: 'Ciclismo', category: ExtraSessionCategory.CARDIO, met: 7.5 },
    stationary_bike: { key: 'stationary_bike', label: 'Bicicleta fija', category: ExtraSessionCategory.CARDIO, met: 7 },
    swimming: { key: 'swimming', label: 'Natación', category: ExtraSessionCategory.CARDIO, met: 8 },
    walking: { key: 'walking', label: 'Caminata', category: ExtraSessionCategory.CARDIO, met: 3.5 },
    weightlifting: { key: 'weightlifting', label: 'Levantamiento de pesas', category: ExtraSessionCategory.STRENGTH, met: 5 },
    crossfit: { key: 'crossfit', label: 'CrossFit', category: ExtraSessionCategory.STRENGTH, met: 9 },
    football: { key: 'football', label: 'Fútbol', category: ExtraSessionCategory.SPORT, met: 8 },
    basketball: { key: 'basketball', label: 'Básquet', category: ExtraSessionCategory.SPORT, met: 7.5 },
    tennis: { key: 'tennis', label: 'Tenis', category: ExtraSessionCategory.SPORT, met: 7 },
    yoga: { key: 'yoga', label: 'Yoga', category: ExtraSessionCategory.MIND_BODY, met: 3 },
    pilates: { key: 'pilates', label: 'Pilates', category: ExtraSessionCategory.MIND_BODY, met: 3.5 },
    mobility: { key: 'mobility', label: 'Movilidad / Stretching', category: ExtraSessionCategory.MIND_BODY, met: 2.5 },
};
exports.EXAMPLE_UPDATE_WEEKLOG_EXTRASESSION_PAYLOAD = {
    updateWeekLogInput: {
        id: "675f3c8b1234567890abcdef",
        days: [
            {
                order: 3,
                extraSession: {
                    date: "2026-04-09T10:00:00.000Z",
                    discipline: "running",
                    duration: 30,
                    intensityLevel: 3,
                    calories: 280
                }
            }
        ]
    }
};
function calculateCalories(met, weightKg = 70, durationMinutes, intensityLevel) {
    const hours = durationMinutes / 60;
    const intensityFactor = 1 + (intensityLevel - 3) * 0.15;
    const adjustedMet = met * intensityFactor;
    return Math.round(adjustedMet * weightKg * hours);
}
function isValidCaloriesOverride(inputCalories, calculatedCalories) {
    return Math.abs(inputCalories - calculatedCalories) <= 400;
}
//# sourceMappingURL=extra-session.types.js.map