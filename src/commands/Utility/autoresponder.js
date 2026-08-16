import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('autoresponder')
        .setDescription('Manage automatic responses')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        .addSubcommand(sub =>
            sub
                .setName('add')
                .setDescription('Add an autoresponder')
                .addStringOption(o =>
                    o
                        .setName('trigger')
                        .setDescription('Word or phrase to detect')
                        .setRequired(true)
                )
                .addStringOption(o =>
                    o
                        .setName('response')
                        .setDescription('Response the bot should send')
                        .setRequired(true)
                )
        )

        .addSubcommand(sub =>
            sub
                .setName('remove')
                .setDescription('Remove an autoresponder')
                .addStringOption(o =>
                    o
                        .setName('trigger')
                        .setDescription('Trigger to remove')
                        .setRequired(true)
                )
        )

        .addSubcommand(sub =>
            sub
                .setName('list')
                .setDescription('List all autoresponders')
        ),

    category: 'utility',

    async execute(interaction, config, client) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        if (!client.autoresponders) {
            client.autoresponders = new Map();
        }

        if (!client.autoresponders.has(guildId)) {
            client.autoresponders.set(guildId, new Map());
        }

        const guildResponders = client.autoresponders.get(guildId);

        if (subcommand === 'add') {
            const trigger = interaction.options
                .getString('trigger')
                .toLowerCase();

            const response = interaction.options.getString('response');

            guildResponders.set(trigger, response);

            await InteractionHelper.safeReply(interaction, {
                content:
                    `✅ Autoresponder added!\n\n` +
                    `**Trigger:** \`${trigger}\`\n` +
                    `**Response:** ${response}`,
                ephemeral: true,
            });

            logger.info(`Autoresponder added`, {
                guildId,
                trigger,
                userId: interaction.user.id,
            });

            return;
        }

        if (subcommand === 'remove') {
            const trigger = interaction.options
                .getString('trigger')
                .toLowerCase();

            if (!guildResponders.has(trigger)) {
                await InteractionHelper.safeReply(interaction, {
                    content: `❌ No autoresponder exists for \`${trigger}\`.`,
                    ephemeral: true,
                });
                return;
            }

            guildResponders.delete(trigger);

            await InteractionHelper.safeReply(interaction, {
                content: `✅ Autoresponder \`${trigger}\` has been removed.`,
                ephemeral: true,
            });

            return;
        }

        if (subcommand === 'list') {
            if (guildResponders.size === 0) {
                await InteractionHelper.safeReply(interaction, {
                    content: '📭 There are no autoresponders configured.',
                    ephemeral: true,
                });
                return;
            }

            const list = [...guildResponders.entries()]
                .map(
                    ([trigger, response]) =>
                        `**${trigger}** → ${response}`
                )
                .join('\n');

            await InteractionHelper.safeReply(interaction, {
                content: `### 🤖 Autoresponders\n\n${list}`,
                ephemeral: true,
            });
        }
    },
};
