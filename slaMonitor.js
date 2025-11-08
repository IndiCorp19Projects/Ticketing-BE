const cron = require("node-cron");
const { sendMail } = require("./utils/mailer");
const { Op } = require("sequelize");
const { Ticket, Client, User, slaBreachmailLogModel } = require("./models");

// Run every 10 minutes
cron.schedule("*/10 * * * *", async () => {
  console.log("🔍 Checking SLA breach warnings...");

  const nowTime = new Date();
  const now = new Date(nowTime.getTime() + 5.5 * 60 * 60 * 1000);
  const warningThreshold = 10 * 60 * 1000;

  try {
    const responseWarningTickets = await Ticket.findAll({
      where: {
        response_at: null,
        sla_response_datetime: {
          [Op.gt]: now, // SLA time is in the future
          [Op.lte]: new Date(now.getTime() + warningThreshold), // within next 10 mins
        },
      },
    });

    const resolveWarningTickets = await Ticket.findAll({
      where: {
        resolved_at: null,
        sla_resolve_datetime: {
          [Op.gt]: now,
          [Op.lte]: new Date(now.getTime() + warningThreshold),
        },
      },
    });

    for (const ticket of responseWarningTickets) {
      if (ticket.client_id) {
        const client = await Client.findByPk(ticket.client_id);

        await sendMail({
          to: client?.email || "john.doe@example.com",
          subject: `⚠️ SLA Response Warning: Ticket #${ticket.id}`,
          text: `Ticket #${ticket.id} is approaching its SLA response deadline.`,
          html: `<p>Dear Team,</p>
               <p>The ticket <strong>#${ticket.id}</strong> will breach its <strong>response SLA</strong> within 10 minutes.</p>
               <p>Please take action immediately.</p>`,
        });

        await slaBreachmailLogModel.create({
          ticket_id: ticket.ticket_id,
          to: client?.email || "john.doe@example.com",
          subject: `⚠️ SLA Response Warning: Ticket #${ticket.id}`,
          text: `Ticket #${ticket.id} is approaching its SLA response deadline.`,
          html: `<p>Dear Team,</p>
               <p>The ticket <strong>#${ticket.id}</strong> will breach its <strong>response SLA</strong> within 10 minutes.</p>
               <p>Please take action immediately.</p>`,
        });
      }

      const user = await User.findOne({ where: { role_name: "admin" } });

      await sendMail({
        to: user?.email || "john.doe@example.com",
        subject: `⚠️ SLA Response Warning: Ticket #${ticket.id}`,
        text: `Ticket #${ticket.id} is approaching its SLA response deadline.`,
        html: `<p>Dear Team,</p>
               <p>The ticket <strong>#${ticket.id}</strong> will breach its <strong>response SLA</strong> within 10 minutes.</p>
               <p>Please take action immediately.</p>`,
      });

      await slaBreachmailLogModel.create({
        ticket_id: ticket.ticket_id,
        to: user?.email || "john.doe@example.com",
        subject: `⚠️ SLA Response Warning: Ticket #${ticket.id}`,
        text: `Ticket #${ticket.id} is approaching its SLA response deadline.`,
        html: `<p>Dear Team,</p>
               <p>The ticket <strong>#${ticket.id}</strong> will breach its <strong>response SLA</strong> within 10 minutes.</p>
               <p>Please take action immediately.</p>`,
      });

      console.log(`📧 SLA Response Warning sent for Ticket #${ticket.id}`);
    }

    // 4️⃣ Send mails for resolve SLA
    for (const ticket of resolveWarningTickets) {
      if (ticket.client_id) {
        const client = await Client.findByPk(ticket.client_id);

        await sendMail({
          to: client?.email || "john.doe@example.com",
          subject: `⚠️ SLA Resolution Warning: Ticket #${ticket.id}`,
          text: `Ticket #${ticket.id} is approaching its SLA resolution deadline.`,
          html: `<p>Dear Team,</p>
               <p>The ticket <strong>#${ticket.id}</strong> will breach its <strong>resolution SLA</strong> within 10 minutes.</p>
               <p>Please resolve it as soon as possible.</p>`,
        });

        await slaBreachmailLogModel.create({
          ticket_id: ticket.ticket_id,
          to: client?.email || "john.doe@example.com",
          subject: `⚠️ SLA Resolution Warning: Ticket #${ticket.id}`,
          text: `Ticket #${ticket.id} is approaching its SLA resolution deadline.`,
          html: `<p>Dear Team,</p>
               <p>The ticket <strong>#${ticket.id}</strong> will breach its <strong>resolution SLA</strong> within 10 minutes.</p>
               <p>Please resolve it as soon as possible.</p>`,
        });
      }

      const user = await User.findOne({ where: { role_name: "admin" } });

      await sendMail({
        to: user?.email || "john.doe@example.com",
        subject: `⚠️ SLA Resolution Warning: Ticket #${ticket.id}`,
        text: `Ticket #${ticket.id} is approaching its SLA resolution deadline.`,
        html: `<p>Dear Team,</p>
               <p>The ticket <strong>#${ticket.id}</strong> will breach its <strong>resolution SLA</strong> within 10 minutes.</p>
               <p>Please resolve it as soon as possible.</p>`,
      });

      await slaBreachmailLogModel.create({
        ticket_id: ticket.ticket_id,
        to: user?.email || "john.doe@example.com",
        subject: `⚠️ SLA Resolution Warning: Ticket #${ticket.id}`,
        text: `Ticket #${ticket.id} is approaching its SLA resolution deadline.`,
        html: `<p>Dear Team,</p>
               <p>The ticket <strong>#${ticket.id}</strong> will breach its <strong>resolution SLA</strong> within 10 minutes.</p>
               <p>Please resolve it as soon as possible.</p>`,
      });

      console.log(`📧 SLA Resolution Warning sent for Ticket #${ticket.id}`);
    }

    console.log("✅ SLA warning check completed.");
  } catch (err) {
    console.error("❌ Error in SLA monitor:", err);
  }
});
