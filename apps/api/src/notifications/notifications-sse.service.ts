import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface SseMessage {
  data: Record<string, unknown>;
}

@Injectable()
export class NotificationsSseService {
  private readonly notificationSubjects = new Map<
    string,
    Subject<Record<string, unknown>>
  >();

  getEventStream(userId: string): Observable<SseMessage> {
    if (!this.notificationSubjects.has(userId)) {
      this.notificationSubjects.set(
        userId,
        new Subject<Record<string, unknown>>(),
      );
    }
    return this.notificationSubjects
      .get(userId)!
      .asObservable()
      .pipe(map((data) => ({ data })));
  }

  pushNotification(userId: string, data: Record<string, unknown>) {
    const subject = this.notificationSubjects.get(userId);
    if (subject) {
      subject.next(data);
    }
  }
}
