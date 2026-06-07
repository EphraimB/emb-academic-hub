import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../types';
import { 
  getCurrentSemester, 
  getCoursesBySemester, 
  getAssignmentsDueInRange,
  getPendingTasksWithPriority,
  Course
} from '../../db/queries';

const weekCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('week')
    .setDescription("View this week's schedule, assignments, and tasks summary"),
  async execute(interaction: ChatInputCommandInteraction) {
    const semester = getCurrentSemester();

    if (!semester) {
      await interaction.reply({
        content: 'No semester is currently active. Use \`/semester switch\` to activate one.',
        flags: ['Ephemeral'] as any
      });
      return;
    }

    // 1. Get current date range (today to 7 days later)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${date}`;

    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const endYear = sevenDaysLater.getFullYear();
    const endMonth = String(sevenDaysLater.getMonth() + 1).padStart(2, '0');
    const endDate = String(sevenDaysLater.getDate()).padStart(2, '0');
    const sevenDaysLaterStr = `${endYear}-${endMonth}-${endDate}`;

    // 2. Fetch all courses for the active semester
    const courses = getCoursesBySemester(semester.id);

    // 3. Fetch assignments due in the next 7 days
    const assignments = getAssignmentsDueInRange(semester.id, todayStr, sevenDaysLaterStr);

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

    // Build Weekly Schedule Text
    const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const groupedCourses: Record<number, Course[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };

    for (const c of courses) {
      try {
        const days = JSON.parse(c.meetingDays) as number[];
        for (const d of days) {
          groupedCourses[d].push(c);
        }
      } catch (err) {
        console.error('Error parsing meeting days for course:', c.name, err);
      }
    }

    const dayOrder = [1, 2, 3, 4, 5, 6, 0]; // Monday to Sunday
    let scheduleText = '';
    let hasAnyClasses = false;

    for (const d of dayOrder) {
      const dayClasses = groupedCourses[d];
      if (dayClasses.length > 0) {
        hasAnyClasses = true;
        dayClasses.sort((a, b) => a.startTime - b.startTime);
        scheduleText += `📅 **${weekDays[d]}**\n`;
        scheduleText += dayClasses.map(c => {
          const startStr = formatTime(c.startTime);
          const endStr = formatTime(c.endTime);
          const loc = c.location ? ` @ \`${c.location}\`` : '';
          return `  - 🏫 **${c.name}** | \`${startStr} - ${endStr}\`${loc}`;
        }).join('\n') + '\n\n';
      }
    }

    // Build response message
    let response = `## 🗓️ Weekly Dashboard: **${semester.name}**\n`;
    response += `*Week range: **${todayStr}** to **${sevenDaysLaterStr}***\n\n`;

    // 📚 Weekly Classes Section
    response += `### 🏫 Weekly Class Schedule\n`;
    if (!hasAnyClasses) {
      response += `*No classes registered under this semester yet.* 📭\n\n`;
    } else {
      response += scheduleText;
    }

    // 📝 Assignments Due Section
    response += `### 📝 Assignments Due (Next 7 Days)\n`;
    if (assignments.length === 0) {
      response += `*No assignments due this week! Excellent schedule clearance!* 🎉\n\n`;
    } else {
      response += assignments.map(a => {
        const priorityLabel = a.priority === 3 ? '🔴' : (a.priority === 2 ? '🟡' : '🟢');
        return `• ${priorityLabel} **${a.title}** (Due: \`${a.dueDate}\`, Course: *${a.courseName}*)`;
      }).join('\n') + '\n\n';
    }

    // ⏳ Pending Tasks Section
    response += `### ⏳ Weekly Tasks Metrics\n`;
    if (pendingTasks.length === 0) {
      response += `*All tasks are completed! You are fully caught up!* \n`;
    } else {
      response += `• Remaining task steps: **${pendingTasks.length}** pending.\n`;
      response += `• Total study time: **${totalPendingMinutes} minutes** (~${Math.round((totalPendingMinutes / 60) * 10) / 10} hours).\n`;
      response += `*Use \`/task list\` to view individual tasks, or \`/available\` to schedule study periods.*`;
    }

    await interaction.reply({
      content: response
    });
  }
};

export default weekCommand;
