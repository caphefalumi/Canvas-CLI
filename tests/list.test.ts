import { describe, test, expect, beforeEach } from 'bun:test';
import { Table } from '../lib/display';

let logs: string[] = [];
let originalLog: typeof console.log;

beforeEach(() => {
  logs = [];
  originalLog = console.log;
  console.log = (...args: any[]) => logs.push(args.join(' '));
});

function restoreLog() {
  console.log = originalLog;
}

describe('List Command - Course List Table', () => {
  test('course list with favorite indicators', () => {
    const columns = [
      { key: 'star', header: '★', width: 3 },
      { key: 'name', header: 'Course Name', flex: 1, minWidth: 20 },
      { key: 'code', header: 'Code', width: 12 }
    ];
    
    const table = new Table(columns, { showRowNumbers: true, title: 'Your Courses' });
    table.addRow({ star: '★', name: 'Introduction to Computer Science', code: 'CS101' });
    table.addRow({ star: ' ', name: 'Advanced Database Systems', code: 'CS401' });
    table.addRow({ star: '★', name: 'Machine Learning Fundamentals', code: 'CS350' });

    try {
      table.render();
      const rendered = logs.join('\n');
      
      expect(rendered).toContain('Your Courses');
      expect(rendered).toContain('★');
      expect(rendered).toContain('Introduction');
      expect(rendered).toContain('CS101');
    } finally {
      restoreLog();
    }
  });

  test('course list with enrollment info', () => {
    // Set sufficient terminal width for content
    Object.defineProperty(process.stdout, 'columns', {
      value: 80,
      writable: true,
      configurable: true
    });

    const columns = [
      { key: 'name', header: 'Course', flex: 1 },
      { key: 'term', header: 'Term', width: 15 },
      { key: 'status', header: 'Status', width: 12 }
    ];
    
    const table = new Table(columns, { showRowNumbers: false });
    table.addRow({ name: 'Web Development', term: 'Fall 2025', status: 'Active' });
    table.addRow({ name: 'Data Structures', term: 'Fall 2025', status: 'Active' });
    table.addRow({ name: 'Algorithms', term: 'Spring 2025', status: 'Completed' });

    try {
      table.render();
      const rendered = logs.join('\n');
      
      expect(rendered).toContain('Web Development');
      expect(rendered).toContain('Fall 2025');
      expect(rendered).toContain('Active');
    } finally {
      restoreLog();
    }
  });

  test('handles very long course names with truncation', () => {
    const columns = [
      { key: 'name', header: 'Course Name', width: 30 },
      { key: 'code', header: 'Code', width: 10 }
    ];
    
    const table = new Table(columns, { showRowNumbers: false });
    table.addRow({
      name: 'Advanced Topics in Distributed Systems and Cloud Computing with Microservices Architecture',
      code: 'CS599'
    });

    try {
      table.render();
      const rendered = logs.join('\n');
      
      expect(rendered).toContain('...');
      expect(rendered).toContain('CS599');
    } finally {
      restoreLog();
    }
  });
});

describe('List Command - Assignment List Table', () => {
  test('assignment list with due dates and points', () => {
    const columns = [
      { key: 'name', header: 'Assignment', flex: 1, minWidth: 20 },
      { key: 'due', header: 'Due Date', width: 20 },
      { key: 'points', header: 'Points', width: 8 }
    ];
    
    const table = new Table(columns, { showRowNumbers: true });
    table.addRow({ name: 'Homework 1', due: 'Dec 15, 2025 11:59 PM', points: '100' });
    table.addRow({ name: 'Project Milestone 1', due: 'Dec 20, 2025 11:59 PM', points: '50' });
    table.addRow({ name: 'Final Exam', due: 'Dec 22, 2025 2:00 PM', points: '200' });

    try {
      table.render();
      const rendered = logs.join('\n');
      
      expect(rendered).toContain('Homework 1');
      expect(rendered).toContain('Dec 15');
      expect(rendered).toContain('100');
      expect(rendered).toContain('#');
    } finally {
      restoreLog();
    }
  });

  test('assignment list with submission status', () => {
    const columns = [
      { key: 'name', header: 'Assignment', flex: 1 },
      { key: 'status', header: 'Status', width: 15 },
      { key: 'grade', header: 'Grade', width: 10 }
    ];
    
    const table = new Table(columns, { showRowNumbers: false });
    table.addRow({ name: 'Lab 1', status: '✓ Submitted', grade: '95/100' });
    table.addRow({ name: 'Lab 2', status: '✓ Graded', grade: '88/100' });
    table.addRow({ name: 'Lab 3', status: '⏳ Pending', grade: '-' });

    try {
      table.render();
      const rendered = logs.join('\n');
      
      expect(rendered).toContain('✓ Submitted');
      expect(rendered).toContain('95/100');
      expect(rendered).toContain('⏳ Pending');
    } finally {
      restoreLog();
    }
  });
});
