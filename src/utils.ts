export class DateUtils {
    static addTime(date: Date, time: number): Date {
        return new Date(date.getTime() + time);
    }

    static fromNow(time: number): Date {
        return this.addTime(new Date(), time);
    }

    static DAYS_TO_MILLIS = 86400000;
}

export class ObjectUtils {
    /**
     * Creates a copy of obj, and copies values from source into
     * the copy, but only if there already is a property with the
     * matching name.
     *
     * @param obj
     * @param source
     */
    static assignOnly(obj: any, source: any): any {
        let newObj = Object.assign(obj);
        if (source != undefined) {
            Object.keys(obj).forEach((key) => {
                if (key in source) {
                    newObj[key] = source[key];
                }
            });
        }
        return newObj;
    }
}
