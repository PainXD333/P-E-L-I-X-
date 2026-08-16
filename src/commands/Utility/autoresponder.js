import {
    SlashCommandBuilder,
    PermissionFlagsBits,
} from 'discord.js';

import { getColor } from '../../config/bot.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { AutoresponderService } from '../../services/autoresponderService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('autoresponder')
        .setDescription('Manage server autoresponders')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        // =========================
        // ADD
        // =========================
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add or update an autoresponder')
                .addStringOption(option =>
                    option
                        .setName('trigger')
                        .setDescription('The word or phrase that triggers the response')
                        .setRequired(true)
                        .setMaxLength(100)
                )
                .addStringOption(option =>
                    option
                        .setName('response')
                        .setDescription('The response the bot should send')
                        .setRequired(true)
                        .setMaxLength(2000)
                )
        )

        // =========================
        // REMOVE
        // =========================
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove an autoresponder')
                .addStringOption(option =>
                    option
                        .setName('trigger')
                        .setDescription('The trigger to remove')
                        .setRequired(true)
                        .setMaxLength(100)
                )
        )

        // =========================
        // LIST
        // =========================
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Show all autoresponders')
        ),

    category: 'utility',

    async execute(interaction, config, client) {

        const deferSuccess =
            await InteractionHelper.safeDefer(interaction);

        if (!deferSuccess) {
            logger.warn('Autoresponder interaction defer failed', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'autoresponder',
            });

            return;
        }

        try {

            const guildId = interaction.guildId;
            const subcommand = interaction.options.getSubcommand();

            // =====================================================
            // ADD
            // =====================================================

            if (subcommand === 'add') {

                const trigger = interaction.options
                    .getString('trigger', true)
                    .trim()
                    .toLowerCase();

                const response = interaction.options
                    .getString('response', true)
                    .trim();

                // -------------------------
                // Validation
                // -------------------------

                if (!trigger) {
                    await InteractionHelper.safeEditReply(
                        interaction,
                        {
                            embeds: [
                                createEmbed({
                                    title: '❌ Invalid Trigger',
                                    description:
                                        'You must provide a trigger.',
                                    color: 'error',
                                }),
                            ],
                        }
                    );

                    return;
                }

                if (!response) {
                    await InteractionHelper.safeEditReply(
                        interaction,
                        {
                            embeds: [
                                createEmbed({
                                    title: '❌ Invalid Response',
                                    description:
                                        'You must provide a response.',
                                    color: 'error',
                                }),
                            ],
                        }
                    );

                    return;
                }

                // -------------------------
                // Save to PostgreSQL
                // -------------------------

                const autoresponder =
                    await AutoresponderService.add({
                        guildId,
                        trigger,
                        response,
                        createdBy: interaction.user.id,
                    });

                logger.info(
                    `Autoresponder added/updated: "${trigger}"`,
                    {
                        guildId,
                        userId: interaction.user.id,
                        autoresponderId: autoresponder?.id,
                    }
                );

                // -------------------------
                // Success Embed
                // -------------------------

                const embed = createEmbed({
                    title: '🤖 Autoresponder Added',
                    description:
                        `The autoresponder has been successfully saved.`,
                    color: 'success',
                });

                embed.addFields(
                    {
                        name: 'Trigger',
                        value: `\`${trigger}\``,
                        inline: true,
                    },
                    {
                        name: 'Response',
                        value: response,
                        inline: false,
                    }
                );

                embed.setFooter({
                    text: `Added by ${interaction.user.tag}`,
                });

                await InteractionHelper.safeEditReply(
                    interaction,
                    {
                        embeds: [embed],
                    }
                );

                return;
            }

            // =====================================================
            // REMOVE
            // =====================================================

            if (subcommand === 'remove') {

                const trigger = interaction.options
                    .getString('trigger', true)
                    .trim()
                    .toLowerCase();

                const removed =
                    await AutoresponderService.remove(
                        guildId,
                        trigger
                    );

                // -------------------------
                // Not found
                // -------------------------

                if (!removed) {

                    await InteractionHelper.safeEditReply(
                        interaction,
                        {
                            embeds: [
                                createEmbed({
                                    title: '❌ Autoresponder Not Found',
                                    description:
                                        `There is no autoresponder for \`${trigger}\`.`,
                                    color: 'error',
                                }),
                            ],
                        }
                    );

                    return;
                }

                logger.info(
                    `Autoresponder removed: "${trigger}"`,
                    {
                        guildId,
                        userId: interaction.user.id,
                    }
                );

                // -------------------------
                // Success
                // -------------------------

                await InteractionHelper.safeEditReply(
                    interaction,
                    {
                        embeds: [
                            createEmbed({
                                title: '🗑️ Autoresponder Removed',
                                description:
                                    `The autoresponder for \`${trigger}\` has been removed.`,
                                color: 'success',
                            }),
                        ],
                    }
                );

                return;
            }

            // =====================================================
            // LIST
            // =====================================================

            if (subcommand === 'list') {

                const responders =
                    await AutoresponderService.getAll(
                        guildId
                    );

                // -------------------------
                // Empty
                // -------------------------

                if (!responders.length) {

                    await InteractionHelper.safeEditReply(
                        interaction,
                        {
                            embeds: [
                                createEmbed({
                                    title: '🤖 Autoresponders',
                                    description:
                                        'This server currently has no autoresponders.',
                                    color: 'info',
                                }),
                            ],
                        }
                    );

                    return;
                }

                // -------------------------
                // Build list
                // -------------------------

                const fields = responders
                    .slice(0, 25)
                    .map((item, index) => {

                        let response = item.response;

                        if (response.length > 500) {
                            response =
                                response.substring(0, 497) +
                                '...';
                        }

                        return {
                            name:
                                `${index + 1}. ` +
                                `\`${item.trigger}\``,

                            value:
                                response,

                            inline: false,
                        };
                    });

                const embed = createEmbed({
                    title: '🤖 Server Autoresponders',
                    description:
                        `Showing **${Math.min(
                            responders.length,
                            25
                        )}** of **${responders.length}** autoresponders.`,
                    color: 'info',
                });

                embed.addFields(fields);

                embed.setFooter({
                    text: `Requested by ${interaction.user.tag}`,
                });

                await InteractionHelper.safeEditReply(
                    interaction,
                    {
                        embeds: [embed],
                    }
                );

                return;
            }

        } catch (error) {

            logger.error(
                'Autoresponder command failed:',
                {
                    error: error?.message || error,
                    stack: error?.stack,
                    guildId: interaction.guildId,
                    userId: interaction.user.id,
                }
            );

            await InteractionHelper.safeEditReply(
                interaction,
                {
                    embeds: [
                        createEmbed({
                            title: '❌ Autoresponder Error',
                            description:
                                'Something went wrong while processing the autoresponder command. Check the bot console for more details.',
                            color: 'error',
                        }),
                    ],
                }
            );
        }
    },
};
