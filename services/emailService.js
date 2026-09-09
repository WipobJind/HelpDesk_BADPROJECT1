const sgMail = require("@sendgrid/mail");
const prisma = require("./prisma");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "helpdesk@campus.local";

async function notifyTechnicians(ticket) {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn("SendGrid API key not configured, skipping email");
    return;
  }

  // Get all technicians and admins
  const technicians = await prisma.user.findMany({
    where: { role: { in: ["TECHNICIAN", "ADMIN"] } },
    select: { email: true, name: true },
  });

  if (technicians.length === 0) return;

  const categoryName = ticket.category?.name || "Uncategorized";
  const requesterName = ticket.requester?.name || "Unknown";

  const msg = {
    to: technicians.map((t) => t.email),
    from: FROM_EMAIL,
    subject: `[HelpDesk] New Ticket #${ticket.id}: ${ticket.title}`,
    text: `A new IT support ticket has been submitted.\n\nTicket #${ticket.id}\nTitle: ${ticket.title}\nCategory: ${categoryName}\nSubmitted by: ${requesterName}\nLocation: ${ticket.roomLocation || "N/A"}\n\nDescription:\n${ticket.description}\n\nPlease log in to the HelpDesk system to claim this ticket.`,
    html: `
      <h2>New IT Support Ticket</h2>
      <table>
        <tr><td><strong>Ticket ID:</strong></td><td>#${ticket.id}</td></tr>
        <tr><td><strong>Title:</strong></td><td>${ticket.title}</td></tr>
        <tr><td><strong>Category:</strong></td><td>${categoryName}</td></tr>
        <tr><td><strong>Submitted by:</strong></td><td>${requesterName}</td></tr>
        <tr><td><strong>Location:</strong></td><td>${ticket.roomLocation || "N/A"}</td></tr>
      </table>
      <h3>Description</h3>
      <p>${ticket.description}</p>
      <p>Please log in to the HelpDesk system to claim this ticket.</p>
    `,
  };

  await sgMail.sendMultiple(msg);
  console.log(`Email notification sent to ${technicians.length} technician(s)`);
}

async function notifyRequester(ticket, message) {
  if (!process.env.SENDGRID_API_KEY) return;

  const requester = await prisma.user.findUnique({
    where: { id: ticket.requesterId },
    select: { email: true, name: true },
  });

  if (!requester) return;

  const msg = {
    to: requester.email,
    from: FROM_EMAIL,
    subject: `[HelpDesk] Update on Ticket #${ticket.id}: ${ticket.title}`,
    text: `Your ticket #${ticket.id} has been updated.\n\nStatus: ${ticket.status}\n\n${message}`,
    html: `
      <h2>Ticket Update</h2>
      <p>Your ticket <strong>#${ticket.id}: ${ticket.title}</strong> has been updated.</p>
      <p><strong>Status:</strong> ${ticket.status}</p>
      <p>${message}</p>
    `,
  };

  await sgMail.send(msg);
}

module.exports = { notifyTechnicians, notifyRequester };
