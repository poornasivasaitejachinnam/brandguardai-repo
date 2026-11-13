/* =========================================================
   BrandGuard AI - Database Schema and Seed Data
   Safe for new laptop setup and idempotent import.
   ========================================================= */

CREATE DATABASE IF NOT EXISTS `brandguard_ai_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `brandguard_ai_db`;

SET FOREIGN_KEY_CHECKS = 0;

/* Table: ai_analyses */
CREATE TABLE IF NOT EXISTS `ai_analyses` (
  `analysis_id` int NOT NULL AUTO_INCREMENT,
  `submission_id` int NOT NULL,
  `guideline_id` int NOT NULL,
  `overall_score` decimal(5,2) DEFAULT NULL,
  `compliance_status` enum('compliant','partially_compliant','non_compliant') COLLATE utf8mb4_unicode_ci NOT NULL,
  `summary` text COLLATE utf8mb4_unicode_ci,
  `model_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `analyzed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`analysis_id`),
  KEY `submission_id` (`submission_id`),
  KEY `guideline_id` (`guideline_id`),
  CONSTRAINT `ai_analyses_ibfk_1` FOREIGN KEY (`submission_id`) REFERENCES `content_submissions` (`submission_id`),
  CONSTRAINT `ai_analyses_ibfk_2` FOREIGN KEY (`guideline_id`) REFERENCES `brand_guidelines` (`guideline_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* Table: ai_analysis_configs */
CREATE TABLE IF NOT EXISTS `ai_analysis_configs` (
  `config_id` int NOT NULL AUTO_INCREMENT,
  `config_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `model_name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `analysis_type` enum('text','image','document','multimodal') COLLATE utf8mb4_unicode_ci NOT NULL,
  `configuration` json DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`config_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* Table: ai_analysis_feedback */
CREATE TABLE IF NOT EXISTS `ai_analysis_feedback` (
  `feedback_id` int NOT NULL AUTO_INCREMENT,
  `run_id` int NOT NULL,
  `user_id` int NOT NULL,
  `rating` int DEFAULT NULL,
  `feedback_text` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`feedback_id`),
  KEY `run_id` (`run_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `ai_analysis_feedback_ibfk_1` FOREIGN KEY (`run_id`) REFERENCES `ai_analysis_runs` (`run_id`) ON DELETE CASCADE,
  CONSTRAINT `ai_analysis_feedback_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `ai_analysis_feedback_chk_1` CHECK (((`rating` is null) or (`rating` between 1 and 5)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* Table: ai_analysis_runs */
CREATE TABLE IF NOT EXISTS `ai_analysis_runs` (
  `run_id` int NOT NULL AUTO_INCREMENT,
  `submission_id` int NOT NULL,
  `guideline_id` int NOT NULL,
  `config_id` int DEFAULT NULL,
  `model_name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `overall_score` decimal(5,2) DEFAULT NULL,
  `compliance_status` enum('compliant','partially_compliant','non_compliant','failed') COLLATE utf8mb4_unicode_ci NOT NULL,
  `analysis_summary` text COLLATE utf8mb4_unicode_ci,
  `processing_time_ms` int DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `started_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`run_id`),
  KEY `guideline_id` (`guideline_id`),
  KEY `config_id` (`config_id`),
  KEY `idx_analysis_runs_submission` (`submission_id`),
  KEY `idx_analysis_runs_status` (`compliance_status`),
  CONSTRAINT `ai_analysis_runs_ibfk_1` FOREIGN KEY (`submission_id`) REFERENCES `content_submissions` (`submission_id`),
  CONSTRAINT `ai_analysis_runs_ibfk_2` FOREIGN KEY (`guideline_id`) REFERENCES `brand_guidelines` (`guideline_id`),
  CONSTRAINT `ai_analysis_runs_ibfk_3` FOREIGN KEY (`config_id`) REFERENCES `ai_analysis_configs` (`config_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* Table: ai_detected_issues */
CREATE TABLE IF NOT EXISTS `ai_detected_issues` (
  `detected_issue_id` int NOT NULL AUTO_INCREMENT,
  `run_id` int NOT NULL,
  `rule_id` int DEFAULT NULL,
  `issue_category` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `severity` enum('low','medium','high','critical') COLLATE utf8mb4_unicode_ci DEFAULT 'medium',
  `detected_text` text COLLATE utf8mb4_unicode_ci,
  `issue_description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `location_reference` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `confidence_score` decimal(5,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`detected_issue_id`),
  KEY `rule_id` (`rule_id`),
  KEY `idx_detected_issues_run` (`run_id`),
  CONSTRAINT `ai_detected_issues_ibfk_1` FOREIGN KEY (`run_id`) REFERENCES `ai_analysis_runs` (`run_id`) ON DELETE CASCADE,
  CONSTRAINT `ai_detected_issues_ibfk_2` FOREIGN KEY (`rule_id`) REFERENCES `guideline_rules` (`rule_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* Table: ai_recommendations */
CREATE TABLE IF NOT EXISTS `ai_recommendations` (
  `recommendation_id` int NOT NULL AUTO_INCREMENT,
  `detected_issue_id` int NOT NULL,
  `original_text` text COLLATE utf8mb4_unicode_ci,
  `suggested_text` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `explanation` text COLLATE utf8mb4_unicode_ci,
  `recommendation_status` enum('pending','accepted','rejected','modified') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`recommendation_id`),
  KEY `detected_issue_id` (`detected_issue_id`),
  CONSTRAINT `ai_recommendations_ibfk_1` FOREIGN KEY (`detected_issue_id`) REFERENCES `ai_detected_issues` (`detected_issue_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* Table: analysis_issues */
CREATE TABLE IF NOT EXISTS `analysis_issues` (
  `issue_id` int NOT NULL AUTO_INCREMENT,
  `analysis_id` int NOT NULL,
  `rule_id` int DEFAULT NULL,
  `issue_category` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `severity` enum('low','medium','high','critical') COLLATE utf8mb4_unicode_ci DEFAULT 'medium',
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `suggested_correction` text COLLATE utf8mb4_unicode_ci,
  `location_reference` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('open','resolved','ignored') COLLATE utf8mb4_unicode_ci DEFAULT 'open',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`issue_id`),
  KEY `analysis_id` (`analysis_id`),
  KEY `rule_id` (`rule_id`),
  CONSTRAINT `analysis_issues_ibfk_1` FOREIGN KEY (`analysis_id`) REFERENCES `ai_analyses` (`analysis_id`) ON DELETE CASCADE,
  CONSTRAINT `analysis_issues_ibfk_2` FOREIGN KEY (`rule_id`) REFERENCES `guideline_rules` (`rule_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* Table: audit_logs */
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `action` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entity_id` int DEFAULT NULL,
  `details` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`),
  KEY `idx_audit_logs_user_date` (`user_id`,`created_at`),
  CONSTRAINT `audit_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* Table: brand_guideline_versions */
CREATE TABLE IF NOT EXISTS `brand_guideline_versions` (
  `version_id` int NOT NULL AUTO_INCREMENT,
  `guideline_id` int NOT NULL,
  `version_number` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `change_summary` text COLLATE utf8mb4_unicode_ci,
  `created_by` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`version_id`),
  KEY `guideline_id` (`guideline_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `brand_guideline_versions_ibfk_1` FOREIGN KEY (`guideline_id`) REFERENCES `brand_guidelines` (`guideline_id`) ON DELETE CASCADE,
  CONSTRAINT `brand_guideline_versions_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* Table: brand_guidelines */
CREATE TABLE IF NOT EXISTS `brand_guidelines` (
  `guideline_id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `version` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('draft','active','archived') COLLATE utf8mb4_unicode_ci DEFAULT 'draft',
  `created_by` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `brand_id` int DEFAULT NULL,
  `effective_from` date DEFAULT NULL,
  `effective_until` date DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  PRIMARY KEY (`guideline_id`),
  KEY `created_by` (`created_by`),
  KEY `fk_guidelines_approver` (`approved_by`),
  KEY `idx_guidelines_brand_status` (`brand_id`,`status`),
  CONSTRAINT `brand_guidelines_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_guidelines_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_guidelines_brand` FOREIGN KEY (`brand_id`) REFERENCES `brands` (`brand_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* Table: brands */
CREATE TABLE IF NOT EXISTS `brands` (
  `brand_id` int NOT NULL AUTO_INCREMENT,
  `organization_id` int NOT NULL,
  `brand_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `brand_description` text COLLATE utf8mb4_unicode_ci,
  `logo_path` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `website` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `industry` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `brand_color` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `brand_tone` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `created_by` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`brand_id`),
  KEY `created_by` (`created_by`),
  KEY `idx_brands_organization` (`organization_id`),
  CONSTRAINT `brands_ibfk_1` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`organization_id`),
  CONSTRAINT `brands_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* Table: compliance_reports */
CREATE TABLE IF NOT EXISTS `compliance_reports` (
  `report_id` int NOT NULL AUTO_INCREMENT,
  `organization_id` int NOT NULL,
  `brand_id` int DEFAULT NULL,
  `generated_by` int NOT NULL,
  `report_title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `report_type` enum('brand_compliance','submission_summary','violation_summary','review_summary','custom') COLLATE utf8mb4_unicode_ci NOT NULL,
  `date_from` date DEFAULT NULL,
  `date_to` date DEFAULT NULL,
  `total_submissions` int DEFAULT '0',
  `compliant_count` int DEFAULT '0',
  `partially_compliant_count` int DEFAULT '0',
  `non_compliant_count` int DEFAULT '0',
  `average_compliance_score` decimal(5,2) DEFAULT NULL,
  `report_data` json DEFAULT NULL,
  `generated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`report_id`),
  KEY `brand_id` (`brand_id`),
  KEY `generated_by` (`generated_by`),
  KEY `idx_reports_organization_date` (`organization_id`,`generated_at`),
  CONSTRAINT `compliance_reports_ibfk_1` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`organization_id`),
  CONSTRAINT `compliance_reports_ibfk_2` FOREIGN KEY (`brand_id`) REFERENCES `brands` (`brand_id`) ON DELETE SET NULL,
  CONSTRAINT `compliance_reports_ibfk_3` FOREIGN KEY (`generated_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* Table: content_categories */
CREATE TABLE IF NOT EXISTS `content_categories` (
  `category_id` int NOT NULL AUTO_INCREMENT,
  `category_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`category_id`),
  UNIQUE KEY `category_name` (`category_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* Table: content_submissions */
CREATE TABLE IF NOT EXISTS `content_submissions` (
  `submission_id` int NOT NULL AUTO_INCREMENT,
  `submitted_by` int NOT NULL,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content_text` longtext COLLATE utf8mb4_unicode_ci,
  `content_type` enum('text','image','document','mixed') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('submitted','analyzing','analysis_completed','changes_requested','approved','rejected') COLLATE utf8mb4_unicode_ci DEFAULT 'submitted',
  `submitted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `brand_id` int DEFAULT NULL,
  `category_id` int DEFAULT NULL,
  `campaign_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `target_audience` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `platform` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`submission_id`),
  KEY `fk_submission_category` (`category_id`),
  KEY `idx_submissions_user_status` (`submitted_by`,`status`),
  KEY `idx_submissions_brand` (`brand_id`),
  CONSTRAINT `content_submissions_ibfk_1` FOREIGN KEY (`submitted_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_submission_brand` FOREIGN KEY (`brand_id`) REFERENCES `brands` (`brand_id`),
  CONSTRAINT `fk_submission_category` FOREIGN KEY (`category_id`) REFERENCES `content_categories` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* Table: content_versions */
CREATE TABLE IF NOT EXISTS `content_versions` (
  `content_version_id` int NOT NULL AUTO_INCREMENT,
  `submission_id` int NOT NULL,
  `version_number` int NOT NULL,
  `content_text` longtext COLLATE utf8mb4_unicode_ci,
  `updated_by` int NOT NULL,
  `change_summary` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`content_version_id`),
  UNIQUE KEY `submission_id` (`submission_id`,`version_number`),
  KEY `updated_by` (`updated_by`),
  CONSTRAINT `content_versions_ibfk_1` FOREIGN KEY (`submission_id`) REFERENCES `content_submissions` (`submission_id`) ON DELETE CASCADE,
  CONSTRAINT `content_versions_ibfk_2` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* Table: guideline_rules */
CREATE TABLE IF NOT EXISTS `guideline_rules` (
  `rule_id` int NOT NULL AUTO_INCREMENT,
  `guideline_id` int NOT NULL,
  `category` enum('tone','terminology','claims','visual','accessibility','other') COLLATE utf8mb4_unicode_ci NOT NULL,
  `rule_title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rule_description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `severity` enum('low','medium','high','critical') COLLATE utf8mb4_unicode_ci DEFAULT 'medium',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `priority` int DEFAULT '1',
  `reference_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`rule_id`),
  KEY `guideline_id` (`guideline_id`),
  CONSTRAINT `guideline_rules_ibfk_1` FOREIGN KEY (`guideline_id`) REFERENCES `brand_guidelines` (`guideline_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* Table: notifications */
CREATE TABLE IF NOT EXISTS `notifications` (
  `notification_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `notification_type` enum('submission','analysis','review','approval','rejection','system') COLLATE utf8mb4_unicode_ci DEFAULT 'system',
  `related_submission_id` int DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`notification_id`),
  KEY `related_submission_id` (`related_submission_id`),
  KEY `idx_notifications_user_read` (`user_id`,`is_read`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `notifications_ibfk_2` FOREIGN KEY (`related_submission_id`) REFERENCES `content_submissions` (`submission_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* Table: organizations */
CREATE TABLE IF NOT EXISTS `organizations` (
  `organization_id` int NOT NULL AUTO_INCREMENT,
  `organization_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `organization_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `industry` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `website` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contact_email` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`organization_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* Table: permissions */
CREATE TABLE IF NOT EXISTS `permissions` (
  `permission_id` int NOT NULL AUTO_INCREMENT,
  `permission_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`permission_id`),
  UNIQUE KEY `permission_name` (`permission_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* Table: report_exports */
CREATE TABLE IF NOT EXISTS `report_exports` (
  `export_id` int NOT NULL AUTO_INCREMENT,
  `report_id` int NOT NULL,
  `exported_by` int NOT NULL,
  `file_format` enum('pdf','csv','xlsx') COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_path` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `exported_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`export_id`),
  KEY `report_id` (`report_id`),
  KEY `exported_by` (`exported_by`),
  CONSTRAINT `report_exports_ibfk_1` FOREIGN KEY (`report_id`) REFERENCES `compliance_reports` (`report_id`) ON DELETE CASCADE,
  CONSTRAINT `report_exports_ibfk_2` FOREIGN KEY (`exported_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* Table: review_action_history */
CREATE TABLE IF NOT EXISTS `review_action_history` (
  `history_id` int NOT NULL AUTO_INCREMENT,
  `review_id` int NOT NULL,
  `previous_decision` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_decision` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `changed_by` int NOT NULL,
  `change_reason` text COLLATE utf8mb4_unicode_ci,
  `changed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`history_id`),
  KEY `review_id` (`review_id`),
  KEY `changed_by` (`changed_by`),
  CONSTRAINT `review_action_history_ibfk_1` FOREIGN KEY (`review_id`) REFERENCES `review_actions` (`review_id`) ON DELETE CASCADE,
  CONSTRAINT `review_action_history_ibfk_2` FOREIGN KEY (`changed_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* Table: review_actions */
CREATE TABLE IF NOT EXISTS `review_actions` (
  `review_id` int NOT NULL AUTO_INCREMENT,
  `submission_id` int NOT NULL,
  `reviewer_id` int NOT NULL,
  `decision` enum('approved','rejected','changes_requested') COLLATE utf8mb4_unicode_ci NOT NULL,
  `comments` text COLLATE utf8mb4_unicode_ci,
  `reviewed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`review_id`),
  KEY `submission_id` (`submission_id`),
  KEY `reviewer_id` (`reviewer_id`),
  CONSTRAINT `review_actions_ibfk_1` FOREIGN KEY (`submission_id`) REFERENCES `content_submissions` (`submission_id`),
  CONSTRAINT `review_actions_ibfk_2` FOREIGN KEY (`reviewer_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* Table: review_assignments */
CREATE TABLE IF NOT EXISTS `review_assignments` (
  `assignment_id` int NOT NULL AUTO_INCREMENT,
  `submission_id` int NOT NULL,
  `reviewer_id` int NOT NULL,
  `assigned_by` int NOT NULL,
  `assignment_status` enum('assigned','in_progress','completed','reassigned') COLLATE utf8mb4_unicode_ci DEFAULT 'assigned',
  `assigned_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`assignment_id`),
  KEY `submission_id` (`submission_id`),
  KEY `reviewer_id` (`reviewer_id`),
  KEY `assigned_by` (`assigned_by`),
  CONSTRAINT `review_assignments_ibfk_1` FOREIGN KEY (`submission_id`) REFERENCES `content_submissions` (`submission_id`),
  CONSTRAINT `review_assignments_ibfk_2` FOREIGN KEY (`reviewer_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `review_assignments_ibfk_3` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* Table: review_comments */
CREATE TABLE IF NOT EXISTS `review_comments` (
  `comment_id` int NOT NULL AUTO_INCREMENT,
  `review_id` int NOT NULL,
  `user_id` int NOT NULL,
  `comment_text` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`comment_id`),
  KEY `review_id` (`review_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `review_comments_ibfk_1` FOREIGN KEY (`review_id`) REFERENCES `review_actions` (`review_id`) ON DELETE CASCADE,
  CONSTRAINT `review_comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* Table: role_permissions */
CREATE TABLE IF NOT EXISTS `role_permissions` (
  `role_id` int NOT NULL,
  `permission_id` int NOT NULL,
  PRIMARY KEY (`role_id`,`permission_id`),
  KEY `permission_id` (`permission_id`),
  CONSTRAINT `role_permissions_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`) ON DELETE CASCADE,
  CONSTRAINT `role_permissions_ibfk_2` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`permission_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* Table: roles */
CREATE TABLE IF NOT EXISTS `roles` (
  `role_id` int NOT NULL AUTO_INCREMENT,
  `role_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `role_name` (`role_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* Table: submission_activity */
CREATE TABLE IF NOT EXISTS `submission_activity` (
  `activity_id` int NOT NULL AUTO_INCREMENT,
  `submission_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `activity_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `activity_description` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`activity_id`),
  KEY `submission_id` (`submission_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `submission_activity_ibfk_1` FOREIGN KEY (`submission_id`) REFERENCES `content_submissions` (`submission_id`) ON DELETE CASCADE,
  CONSTRAINT `submission_activity_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* Table: submission_files */
CREATE TABLE IF NOT EXISTS `submission_files` (
  `file_id` int NOT NULL AUTO_INCREMENT,
  `submission_id` int NOT NULL,
  `original_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stored_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_path` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_size` bigint DEFAULT NULL,
  `uploaded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `uploaded_by` int DEFAULT NULL,
  `file_hash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `scan_status` enum('pending','clean','flagged','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  PRIMARY KEY (`file_id`),
  KEY `submission_id` (`submission_id`),
  KEY `fk_file_uploader` (`uploaded_by`),
  CONSTRAINT `fk_file_uploader` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `submission_files_ibfk_1` FOREIGN KEY (`submission_id`) REFERENCES `content_submissions` (`submission_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* Table: system_settings */
CREATE TABLE IF NOT EXISTS `system_settings` (
  `setting_id` int NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `setting_value` text COLLATE utf8mb4_unicode_ci,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_id`),
  UNIQUE KEY `setting_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* Table: users */
CREATE TABLE IF NOT EXISTS `users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `full_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('admin','content_creator','reviewer') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `organization_id` int DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_users_role` (`role`),
  KEY `idx_users_organization` (`organization_id`),
  CONSTRAINT `fk_users_organization` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`organization_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* =========================================================
   Reference Data (Roles, Content Categories, System Settings)
   ========================================================= */

/* Seed data for roles */
INSERT IGNORE INTO `roles` (`role_id`, `role_name`, `description`, `created_at`) VALUES (1, 'admin', 'Manages the platform and system settings', '2026-11-07 15:09:23');
INSERT IGNORE INTO `roles` (`role_id`, `role_name`, `description`, `created_at`) VALUES (2, 'content_creator', 'Submits brand-related content for analysis', '2026-11-07 15:09:23');
INSERT IGNORE INTO `roles` (`role_id`, `role_name`, `description`, `created_at`) VALUES (3, 'reviewer', 'Reviews AI analysis and approves or rejects content', '2026-11-07 15:09:23');

/* Seed data for content_categories */
INSERT IGNORE INTO `content_categories` (`category_id`, `category_name`, `description`, `created_at`) VALUES (1, 'Social Media', 'Social media posts and campaigns', '2026-11-07 15:17:17');
INSERT IGNORE INTO `content_categories` (`category_id`, `category_name`, `description`, `created_at`) VALUES (2, 'Website', 'Website content and landing pages', '2026-11-07 15:17:17');
INSERT IGNORE INTO `content_categories` (`category_id`, `category_name`, `description`, `created_at`) VALUES (3, 'Advertisement', 'Digital and print advertising content', '2026-11-07 15:17:17');
INSERT IGNORE INTO `content_categories` (`category_id`, `category_name`, `description`, `created_at`) VALUES (4, 'Email', 'Marketing emails and newsletters', '2026-11-07 15:17:17');
INSERT IGNORE INTO `content_categories` (`category_id`, `category_name`, `description`, `created_at`) VALUES (5, 'Document', 'Brand-related documents and reports', '2026-11-07 15:17:17');
INSERT IGNORE INTO `content_categories` (`category_id`, `category_name`, `description`, `created_at`) VALUES (6, 'Other', 'Other brand-related content', '2026-11-07 15:17:17');

/* Seed data for system_settings */
INSERT IGNORE INTO `system_settings` (`setting_id`, `setting_key`, `setting_value`, `description`, `updated_at`) VALUES (1, 'max_upload_size_mb', '10', 'Maximum content upload size', '2026-11-07 15:25:55');
INSERT IGNORE INTO `system_settings` (`setting_id`, `setting_key`, `setting_value`, `description`, `updated_at`) VALUES (2, 'allowed_file_types', 'pdf,doc,docx,png,jpg,jpeg', 'Allowed content file extensions', '2026-11-07 15:25:55');
INSERT IGNORE INTO `system_settings` (`setting_id`, `setting_key`, `setting_value`, `description`, `updated_at`) VALUES (3, 'default_analysis_language', 'English', 'Default AI analysis language', '2026-11-07 15:25:55');
INSERT IGNORE INTO `system_settings` (`setting_id`, `setting_key`, `setting_value`, `description`, `updated_at`) VALUES (4, 'notification_enabled', 'true', 'Enable system notifications', '2026-11-07 15:25:55');

SET FOREIGN_KEY_CHECKS = 1;
