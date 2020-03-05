import { BulmaColor } from "../declarations/Types";
import { logc } from "../util/log";

type FuncTyp<T> = T extends void ? () => any : (param: T) => any;

class SseEventHandler<T = void> {
	private eventName: string;
	private callList: (FuncTyp<T>)[];

	constructor(eventName: string) {
		this.eventName = eventName;
		this.callList = [];
	}

	public invoke(param: T): void {
		logc("Event", this.eventName);
		for (const func of this.callList) {
			func(param);
		}
	}

	public register(func: FuncTyp<T>): void {
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
	public static readonly StatusInfo = new SseEventHandler<{ text: string }>("StatusInfo");

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
