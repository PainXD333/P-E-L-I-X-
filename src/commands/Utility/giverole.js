import {
    SlashCommandBuilder,
    PermissionFlagsBits
} from 'discord.js';

import { createEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('giverole')
        .setDescription('Give any role to a member')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Member to give the role to')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('role')
                .setDescription('Role name (e.g. Staff, Founder, VIP)')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    category: 'utility',

    async execute(interaction) {
        const defer = await InteractionHelper.safeDefer(interaction);

        if (!defer) return;

        try {
            const target = interaction.options.getUser('user');
            const roleName = interaction.options.getString('role');

            const member = await interaction.guild.members.fetch(target.id);

            const role = interaction.guild.roles.cache.find(
                r => r.name.toLowerCase() === roleName.toLowerCase()
            );

            if (!role) {
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        createEmbed({
                            title: 'Role Not Found',
                            description: `No role named **${roleName}** exists in this server.`,
                            color: 'error'
                        })
                    ]
                });
            }

            if (member.roles.cache.has(role.id)) {
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        createEmbed({
                            title: 'Already Has Role',
                            description: `${member} already has **${role.name}**.`,
                            color: 'warning'
                        })
                    ]
                });
            }

            const botMember = interaction.guild.members.me;

            if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        createEmbed({
                            title: 'Missing Permission',
                            description: 'I need the **Manage Roles** permission.',
                            color: 'error'
                        })
                    ]
                });
            }

            if (role.position >= botMember.roles.highest.position) {
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        createEmbed({
                            title: 'Role Too High',
                            description: `I cannot give **${role.name}** because it is above my highest role.`,
                            color: 'error'
                        })
                    ]
                });
            }

            await member.roles.add(
                role,
                `Given by ${interaction.user.tag}`
            );

            logger.info(
                `${interaction.user.tag} gave ${role.name} to ${member.user.tag}`
            );

            return InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    createEmbed({
                        title: 'Role Given',
                        description:
                            `Successfully gave **${role.name}** to ${member}.`,
                        color: 'success'
                    })
                ]
            });

        } catch (error) {
            logger.error('giverole command failed', error);

            return InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    createEmbed({
                        title: 'Error',
                        description: 'Failed to give the role.',
                        color: 'error'
                    })
                ]
            });
        }
    }
};
