import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../types';
import { 
  getCurrentSemester, 
  getTodayCourses, 
  getAssignmentsDueInRange,
  getPendingTasksWithPriority
} from '../../db/queries';

const todayCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('today')
    .setDescription("View today's schedule, assignments, and pending tasks"),
  async execute(interaction: ChatInputCommandInteraction) {
    const semester = getCurrentSemester();

    if (!semester) {
      await interaction.reply({
        content: 'No semester is currently active. Use \`/semester switch\` to activate one.',
        flags: ['Ephemeral'] as any
      });
      return;
    }

    // 1. Get today's local date details
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${date}`;
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekdayName = weekdays[dayOfWeek];

    // 2. Fetch today's courses
    const todayCourses = getTodayCourses(semester.id, dayOfWeek);
    // Sort courses by start time
    todayCourses.sort((a, b) => a.startTime - b.startTime);

    // 3. Fetch assignments (due today + next 3 days)
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const endYear = threeDaysLater.getFullYear();
    const endMonth = String(threeDaysLater.getMonth() + 1).padStart(2, '0');
    const endDate = String(threeDaysLater.getDate()).padStart(2, '0');
    const threeDaysLaterStr = `${endYear}-${endMonth}-${endDate}`;

    const assignments = getAssignmentsDueInRange(semester.id, todayStr, threeDaysLaterStr);

    const dueToday = assignments.filter(a => a.dueDate === todayStr);
    const upcoming = assignments.filter(a => a.dueDate !== todayStr);

    // 4. Fetch pending tasks summary
    const pendingTasks = getPendingTasksWithPriority();
    const totalPendingMinutes = pendingTasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);

    // Helper to format time
    const formatTime = (min: number) => {
      const h = Math.floor(min / 60);
      const m = min % 60;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const formattedH = h % 12 === 0 ? 12 : h % 12;
      const formattedM = m < 10 ? `0${m}` : m;
      return `${formattedH}:${formattedM} ${ampm}`;
    };

    // Build response message
    let response = `## 📅 Daily Dashboard: **${semester.name}**\n`;
    response += `*Today is **${weekdayName}, ${todayStr}***\n\n`;

    // 📚 Courses Section
    response += `### 📚 Today's Classes\n`;
    if (todayCourses.length === 0) {
      response += `*No classes scheduled for today. Enjoy your day off!* 🎉\n`;
    } else {
      response += todayCourses.map(c => {
        const startStr = formatTime(c.startTime);
        const endStr = formatTime(c.endTime);
        const loc = c.location ? ` @ \`${c.location}\`` : '';
        return `• 🏫 **${c.name}** | \`${startStr} - ${endStr}\`${loc}`;
      }).join('\n') + '\n';
    }
    response += `\n`;

    // 📝 Assignments Section
    response += `### 📝 Assignments Due Today\n`;
    if (dueToday.length === 0) {
      response += `*No assignments due today!* \n`;
    } else {
      response += dueToday.map(a => {
        const priorityLabel = a.priority === 3 ? '🔴 High' : (a.priority === 2 ? '🟡 Medium' : '🟢 Low');
        return `• ⚠️ **${a.title}** (Course: *${a.courseName}*, Priority: ${priorityLabel})`;
      }).join('\n') + '\n';
    }
    response += `\n`;

    // ⏳ Upcoming Assignments Section
    response += `### 🗓️ Upcoming (Next 3 Days)\n`;
    if (upcoming.length === 0) {
      response += `*No upcoming assignments in the next 3 days.* \n`;
    } else {
      response += upcoming.map(a => {
        const priorityLabel = a.priority === 3 ? '🔴' : (a.priority === 2 ? '🟡' : '🟢');
        return `• ${priorityLabel} **${a.title}** (Due: \`${a.dueDate}\`, Course: *${a.courseName}*)`;
      }).join('\n') + '\n';
    }
    response += `\n`;

    // 🔨 Tasks Section
    response += `### ⏳ Pending Tasks Summary\n`;
    if (pendingTasks.length === 0) {
      response += `*All tasks are completed! Nice work!* \n`;
    } else {
      response += `• You have **${pendingTasks.length}** pending task steps.\n`;
      response += `• Estimated time required: **${totalPendingMinutes} minutes** (approx. ${Math.round((totalPendingMinutes / 60) * 10) / 10} hours).\n`;
      response += `*Use \`/task list\` to view them all, or \`/available\` to schedule them.*`;
    }

    await interaction.reply({
      content: response
    });
  }
};

export default todayCommand;
