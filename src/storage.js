const DATABASE_NAME = 'student-management-system';
const DATABASE_VERSION = 1;

let databasePromise;

export function openDatabase() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('This browser does not support IndexedDB.'));
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains('students')) database.createObjectStore('students', { keyPath: 'id' });
        if (!database.objectStoreNames.contains('attendance')) database.createObjectStore('attendance', { keyPath: 'key' });
        if (!database.objectStoreNames.contains('settings')) database.createObjectStore('settings', { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open the local database.'));
      request.onblocked = () => reject(new Error('The database is blocked by another open application tab.'));
    });
  }
  return databasePromise;
}

export async function getAll(storeName) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not read saved data.'));
  });
}

export async function putRecord(storeName, record) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).put(record);
    transaction.oncomplete = () => resolve(record);
    transaction.onerror = () => reject(transaction.error || new Error('Could not save the record.'));
    transaction.onabort = () => reject(transaction.error || new Error('The save was cancelled.'));
  });
}

export async function deleteRecord(storeName, key) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).delete(key);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('Could not delete the record.'));
  });
}

export async function getSettings() {
  const records = await getAll('settings');
  return records.find((record) => record.key === 'school')?.value || {};
}

export async function saveSettings(value) {
  return putRecord('settings', { key: 'school', value });
}

export async function replaceBackup(backup) {
  if (backup?.format !== 'student-management-backup' || backup?.version !== 1 || !Array.isArray(backup.students) || !Array.isArray(backup.attendance) || !backup.settings || typeof backup.settings !== 'object') {
    throw new Error('This file is not a valid Student Management System backup.');
  }
  if (backup.students.some((student) => !student.id || !student.fullName)) throw new Error('The backup contains an invalid student record.');
  if (backup.attendance.some((record) => !record.key || !record.studentId || !record.date)) throw new Error('The backup contains an invalid attendance record.');
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['students', 'attendance', 'settings'], 'readwrite');
    const students = transaction.objectStore('students');
    const attendance = transaction.objectStore('attendance');
    const settings = transaction.objectStore('settings');
    students.clear();
    attendance.clear();
    settings.clear();
    backup.students.forEach((student) => students.put(student));
    backup.attendance.forEach((record) => attendance.put(record));
    settings.put({ key: 'school', value: backup.settings });
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('Could not restore this backup.'));
    transaction.onabort = () => reject(transaction.error || new Error('Backup restore was cancelled.'));
  });
}