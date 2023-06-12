import { Component } from '@angular/core';
import axios from 'axios';
import * as moment from 'moment';
import { CalendarEvent, CalendarView } from 'angular-calendar';
import { EventColor } from 'calendar-utils';

interface Input {
  name: string;
  color:string;
}

interface Course {
  crn: string;
  name: string;
  days: string;
  time: string;
  color:string;
}

@Component({
  selector: 'app-schedule-page',
  templateUrl: './schedule-page.component.html',
  styleUrls: ['./schedule-page.component.scss'],
})
export class SchedulePageComponent {
  currentPage: number = 1;
  schedulesPerPage: number = 1;  

  totalPages(): number {
    return Math.ceil(this.schedules.length / this.schedulesPerPage);
  }

  colors: Record<string, EventColor> = {
    red: {
      primary: '#ad2121',
      secondary: '#FAE3E3',
    },
    blue: {
      primary: '#1e90ff',
      secondary: '#D1E8FF',
    },
    yellow: {
      primary: '#e3bc08',
      secondary: '#FDF1BA',
    },
  };

  viewDate: Date = new Date();
  dayStartHour:number=8;
  dayEndHour:number=19;
  start: Date;
  end: Date;
  events: CalendarEvent[] = [];
  paginatedSchedules: Course[][] = []; 

  constructor() {
    const now = moment();

    this.start = now.startOf('day').add(2, 'hours').toDate();
    this.end = now.add(2, 'hours').toDate();

    this.events = [
      {
        start: this.start,
        end: this.end,
        title: 'A draggable and resizable event',
      },
    ];
  }

  //  Days: MWFS - Time: 09:30am-10:45am09:30am-10:20am09:00am-10:15am  4 classes per week
  // TRF - Time: 12:30pm-01:45pm10:00am-10:50am 3 classes per week

  convertToCalendarEvents(paginatedSchedules: Course[][]): CalendarEvent[] {    //the libray
    const dayMap = new Map<string, number>([
      ['M', 1],
      ['T', 2],
      ['W', 3],
      ['R', 4],
      ['F', 5],
      ['S', 6],
      ['U', 0],
    ]);

    return paginatedSchedules.flatMap((schedule: Course[]) => {
      return schedule.flatMap((course: Course) => {
        const days = course.days;
        const events: CalendarEvent[] = [];

        var daycount=0;
        var timestring = course.time;
        for (const day of days) {
          daycount++;
          const dayIndex = dayMap.get(day);

          if (dayIndex !== undefined) {
            
            var start = moment(course.time.split('-')[0], 'hh:mma')
              .day(dayIndex)
              .toDate(); // Set the day for the start time
            var end = moment(course.time.split('-')[1], 'hh:mma')
              .day(dayIndex)
              .toDate(); // Set the day for the end time


            if(daycount>=3 && course.time.length>15){
              console.log(timestring)
              timestring = timestring.slice(15)
              console.log(timestring)
            }

            if(timestring && timestring.length>0 && (daycount==3 || daycount==4)){
              console.log(dayIndex)
              // secondstart = course.time.split('-')[1].slice(7);
              start = moment(timestring.split('-')[0], 'hh:mma')
                .day(dayIndex)
                .toDate(); // Set the day for the start time
              end = moment(timestring.split('-')[1], 'hh:mma')
                .day(dayIndex)
                .toDate();
            }

            const event: CalendarEvent = {
              start,
              end,
              title: course.name + '\n' + course.crn,
              color: { primary: course.color, secondary: course.color },
              meta: {
                crn: course.crn,
                days: course.days,
                time: course.time,
              },
            };
            events.push(event);
          }
        }

        return events;
      });
    });
  }

  inputList: Input[] = [{ name: 'ENC 1101',color:"#00FF00"}];     //Input interface
  schedules: Course[][] = [];   //course interface

  handleAddClick(): void {
    this.inputList.push({ name: '',color:"white" });
  }

  handleRemoveClick(): void {
    this.inputList.pop();
  }

  async generateSchedules(): Promise<void> {
    const courses = await Promise.all(
      this.inputList.map(async ({ name,color }) => {
        const response = await axios.get(
          `http://localhost:3000/courses/${name}`
        );
        return {
          name,
          times: response.data
            .map((course: any) => ({
              crn: course?.CRN,
              name: course?.TITLE,
              days: course?.DAYS,
              time: course?.TIME.trim(),
              color:color
            }))
            .filter((course: Course) => course.time.toUpperCase() !== 'TBA'),
        };
      })
    );

    const validcourses = courses.filter((e) => e.times.length !== 0);
    const generatedSchedules = this.generateSchedulesBacktracking(validcourses);
    this.schedules = generatedSchedules; // Assign all generated schedules

    this.currentPage = 1;
    this.paginateSchedules(); // Call the pagination method
  }

  paginateSchedules(): void {
    const startIndex = (this.currentPage - 1) * this.schedulesPerPage;
    const endIndex = startIndex + this.schedulesPerPage;
    this.paginatedSchedules = this.schedules.slice(startIndex, endIndex);
  }

  nextPage(): void {
    const totalPages = this.totalPages();
    if (this.currentPage < totalPages) {
      this.currentPage++;
      this.paginateSchedules(); // Update paginated schedules for the new page
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.paginateSchedules(); // Update paginated schedules for the new page
    }
  }

  generateSchedulesBacktracking(
    courses: { name: string; times: Course[] }[],
    currentSchedule: Course[] = [],
    schedules: Course[][] = []
  ): Course[][] {
    if (!courses.length) {
      schedules.push(currentSchedule);
      return schedules;
    }

    const [currentCourse, ...remainingCourses] = courses;

    for (const course of currentCourse.times) {
      if (!this.doesTimeOverlap(currentSchedule, course)) {
        this.generateSchedulesBacktracking(
          remainingCourses,
          [...currentSchedule, course],
          schedules
        );
      }
    }

    return schedules;
  }

  doesTimeOverlap(currentSchedule: Course[], newCourse: Course): boolean {
    return currentSchedule.some(({ days, time }) => {
      const [currentStart, currentEnd] = time
        .split('-')
        .map((t) => parseInt(t.replace(':', ''), 10));
      const [newStart, newEnd] = newCourse.time
        .split('-')
        .map((t) => parseInt(t.replace(':', ''), 10));

      const overlappingDays = [...days].filter((day) =>
        newCourse.days.includes(day)
      );

      if (overlappingDays.length === 0) {
        return false;
      }

      return (
        (newStart >= currentStart && newStart <= currentEnd) ||
        (newEnd >= currentStart && newEnd <= currentEnd)
      );
    });
  }
}
