import { BulmaColor } from "../declarations/Types";
import { logc } from "../util/log";

class SseEventHandler {
	private eventName: string;
	private callList: (() => any)[];

	constructor(eventName: string) {
		this.eventName = eventName;
		this.callList = [];
	}

	public invoke(): void {
		logc("Event", this.eventName);
		for (const func of this.callList) {
			func();
		}
	}

	public register(func: () => any): void {
		this.callList.push(func);
	}
}

// tslint:disable-next-line: max-classes-per-file
export default class SseEvent {
	// tslint:disable: variable-name
	public static readonly UserCacheChanged = new SseEventHandler("UserCacheChanged");
	public static readonly CompareUserChanged = new SseEventHandler("CompareUserChanged");
	public static readonly PinnedUserChanged = new SseEventHandler("PinnedUserChanged");
	public static readonly UserNotification = new SseEventHandler("UserNotification");

	public static addNotification(notify: IUserNotification): void {
		this.notificationList.push(notify);
		SseEvent.UserNotification.invoke();
	}
	public static getNotifications(): IUserNotification[] {
		return this.notificationList;
	}
	private static readonly notificationList: IUserNotification[] = [];
}

export interface IUserNotification {
	msg: string;
	type: BulmaColor;
}
