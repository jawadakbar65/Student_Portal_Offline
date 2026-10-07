        const scheduleData = [
            { day: 'Mon', dayNum: 15, title: 'HTML & CSS Basics', time: '09:00 - 12:00', status: 'completed' },
            { day: 'Tue', dayNum: 16, title: 'JavaScript Fundamentals', time: '09:00 - 12:00', status: 'completed' },
            { day: 'Wed', dayNum: 17, title: 'DOM Manipulation', time: '09:00 - 12:00', status: 'upcoming' },
            { day: 'Thu', dayNum: 18, title: 'React Introduction', time: '09:00 - 12:00', status: 'upcoming' },
            { day: 'Fri', dayNum: 19, title: 'Project Work', time: '09:00 - 12:00', status: 'upcoming' },
        ];

        const assignmentData = [
            { title: 'Create Responsive Landing Page', deadline: 'Due: Jan 20, 2024', status: 'pending', iconType: 'pending' },
            { title: 'JavaScript Quiz - Week 3', deadline: 'Submitted: Jan 15, 2024', status: 'submitted', iconType: 'submitted' },
            { title: 'CSS Grid Layout Exercise', deadline: 'Late: Jan 12, 2024', status: 'late', iconType: 'late' },
            { title: 'Form Validation Project', deadline: 'Due: Jan 25, 2024', status: 'pending', iconType: 'pending' },
        ];

        function renderSchedule() {
            const container = document.getElementById('scheduleList');
            if (!container) return;
            container.innerHTML = scheduleData.map(item => `
                <div class="schedule-item">
                    <div class="schedule-day">
                        <span class="schedule-day-name">${item.day}</span>
                        <span class="schedule-day-date">${item.dayNum}</span>
                    </div>
                    <div class="schedule-info">
                        <div class="schedule-title">${item.title}</div>
                        <div class="schedule-time">${item.time}</div>
                    </div>
                    <span class="schedule-status ${item.status}">${item.status === 'completed' ? 'Completed' : 'Upcoming'}</span>
                </div>
            `).join('');
        }

  
        function renderAssignments() {
            const container = document.getElementById('assignmentList');
            if (!container) return;
            container.innerHTML = assignmentData.map(item => `
                <div class="assignment-item">
                    <div class="assignment-icon ${item.iconType}">
                        ${item.iconType === 'pending' ? `
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <polyline points="12 6 12 12 16 14"/>
                            </svg>
                        ` : item.iconType === 'submitted' ? `
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                <polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                        ` : `
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="12" y1="8" x2="12" y2="12"/>
                                <line x1="12" y1="16" x2="12.01" y2="16"/>
                            </svg>
                        `}
                    </div>
                    <div class="assignment-info">
                        <div class="assignment-title">${item.title}</div>
                        <div class="assignment-deadline">${item.deadline}</div>
                    </div>
                    <span class="assignment-status ${item.status}">${item.status.charAt(0).toUpperCase() + item.status.slice(1)}</span>
                </div>
            `).join('');
        }

        const mobileToggle = document.getElementById('mobileToggle');
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');

        if (mobileToggle && sidebar && sidebarOverlay) {
            mobileToggle.addEventListener('click', () => {
                sidebar.classList.toggle('active');
                sidebarOverlay.classList.toggle('active');
            });

            sidebarOverlay.addEventListener('click', () => {
                sidebar.classList.remove('active');
                sidebarOverlay.classList.remove('active');
            });
        }

        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', function() {
                document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                this.classList.add('active');
            });
        });


        renderSchedule();
        renderAssignments();

        window.addEventListener('load', () => {
            setTimeout(() => {
                document.querySelectorAll('.progress-fill, .stat-progress-fill').forEach(bar => {
                    bar.style.transition = 'width 1s ease-out';
                });
            }, 300);
        });